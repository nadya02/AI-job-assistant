// Ranks the triaged jobs and writes the weekly shortlist. No LLM.
// Run with:  npm run rank [-- --no-notify] [-- --top 10]
//
// Reads matches/job-triage/*.json, writes reports/<date>.md and fires a macOS
// notification. Nothing is sent anywhere.
//
//   rank = 0.6 x fit + 0.2 x interest + 0.2 x freshness
//
// Dropped before ranking: verdict Skip, language blocker, too senior, excluded
// industry, video application. At most 2 jobs per company (the best are kept).
// If no Reach / Long shot job made the list, the best one replaces the last row.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const WEIGHTS = { fit: 0.6, interest: 0.2, freshness: 0.2 };
const FRESH_DAYS = 7; // posted this recently = full freshness
const STALE_DAYS = 45; // freshness reaches its floor here
const FRESH_FLOOR = 20;
const MAX_PER_COMPANY = 2;

const { values } = parseArgs({
  options: {
    top: { type: 'string', default: '10' },
    'no-notify': { type: 'boolean', default: false },
  },
});
const TOP = Number(values.top);

interface Triage {
  jobId: string;
  title: string;
  company: string;
  posted_at?: string;
  match_score: number;
  verdict: string;
  too_senior?: boolean;
  language_blocker?: boolean;
  language_quote?: string;
  excluded?: boolean;
  interest: number;
  interest_reason?: string;
  application_format?: string;
  company_type?: string;
  tone?: string;
  top_skills?: string[];
  gaps?: { gap: string; label: string }[];
  one_line_reason?: string;
}

interface Ranked extends Triage {
  freshDays: number | null;
  freshness: number;
  rank: number;
}

const root = fileURLToPath(new URL('../', import.meta.url));
const matchDir = `${root}matches/job-triage/`;

function freshnessOf(postedAt: string | undefined): { days: number | null; score: number } {
  if (!postedAt) return { days: null, score: 50 };
  const days = Math.max(0, Math.floor((Date.now() - new Date(postedAt).getTime()) / 86_400_000));
  if (days <= FRESH_DAYS) return { days, score: 100 };
  if (days >= STALE_DAYS) return { days, score: FRESH_FLOOR };
  const t = (days - FRESH_DAYS) / (STALE_DAYS - FRESH_DAYS);
  return { days, score: Math.round(100 - t * (100 - FRESH_FLOOR)) };
}

function dropReason(t: Triage): string | null {
  if (t.language_blocker) return t.language_quote ? `German required: "${t.language_quote}"` : 'German required';
  if (t.excluded) return 'excluded industry';
  if (t.too_senior) return 'too senior';
  if (t.verdict === 'Skip') return 'verdict Skip';
  if (t.application_format === 'video') return 'video application';
  return null;
}

function main() {
  const all: Triage[] = readdirSync(matchDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`${matchDir}${f}`, 'utf8')));

  const dropped: { t: Triage; reason: string }[] = [];
  const candidates: Ranked[] = [];
  for (const t of all) {
    const reason = dropReason(t);
    if (reason) {
      dropped.push({ t, reason });
      continue;
    }
    const f = freshnessOf(t.posted_at);
    const rank = WEIGHTS.fit * t.match_score + WEIGHTS.interest * t.interest + WEIGHTS.freshness * f.score;
    candidates.push({ ...t, freshDays: f.days, freshness: f.score, rank: Math.round(rank * 10) / 10 });
  }
  candidates.sort((a, b) => b.rank - a.rank);

  // At most MAX_PER_COMPANY jobs per company: the best ones win.
  const perCompany = new Map<string, number>();
  const unique: Ranked[] = [];
  for (const c of candidates) {
    const key = c.company.trim().toLowerCase();
    const count = perCompany.get(key) ?? 0;
    if (count >= MAX_PER_COMPANY) {
      dropped.push({ t: c, reason: `${MAX_PER_COMPANY} better jobs at the same company` });
      continue;
    }
    perCompany.set(key, count + 1);
    unique.push(c);
  }

  const top = unique.slice(0, TOP);
  const rest = unique.slice(TOP);

  // Keep one stretch job in the list if there is one.
  const isStretch = (r: Ranked) => r.verdict === 'Reach' || r.verdict === 'Long shot';
  if (top.length === TOP && !top.some(isStretch)) {
    const idx = rest.findIndex(isStretch);
    if (idx !== -1) top[TOP - 1] = rest.splice(idx, 1)[0];
  }

  const date = new Date().toISOString().slice(0, 10);
  const out = [`# Weekly shortlist, ${date}`, ''];
  out.push(`Triaged: ${all.length}. Ranked: ${unique.length}. Dropped: ${dropped.length}.`, '');
  out.push('| # | Company | Role | Rank | Fit | Interest | Posted | Verdict | Application |');
  out.push('|---|---|---|---|---|---|---|---|---|');
  top.forEach((r, i) => {
    const posted = r.freshDays === null ? 'unknown' : `${r.freshDays}d ago`;
    out.push(
      `| ${i + 1} | ${r.company} | ${r.title} | ${r.rank} | ${r.match_score} | ${r.interest} | ${posted} | ${r.verdict} | ${r.application_format ?? '?'} |`,
    );
  });
  out.push('', '## Details', '');
  top.forEach((r, i) => {
    out.push(`### ${i + 1}. ${r.company}: ${r.title}`, `Job id \`${r.jobId}\`. ${r.company_type ?? ''}, tone: ${r.tone ?? '?'}`, '');
    if (r.one_line_reason) out.push(`- Why: ${r.one_line_reason}`);
    if (r.top_skills?.length) out.push(`- Lead with: ${r.top_skills.join(', ')}`);
    if (r.gaps?.length) out.push(`- Gaps: ${r.gaps.map((g) => `${g.gap} (${g.label})`).join('; ')}`);
    if (r.interest_reason) out.push(`- Interest: ${r.interest_reason}`);
    out.push('');
  });
  if (rest.length) {
    out.push('## Ranked, below the cut', '');
    for (const r of rest) out.push(`- ${r.company}: ${r.title} (rank ${r.rank}, id \`${r.jobId}\`)`);
    out.push('');
  }
  if (dropped.length) {
    out.push('## Dropped', '');
    for (const d of dropped) out.push(`- ${d.t.company}: ${d.t.title} (${d.reason})`);
    out.push('');
  }
  out.push('## Next', '', 'Choose the jobs to write letters for and pass their ids to `npm run letters`.', '');

  mkdirSync(`${root}reports/`, { recursive: true });
  const file = `${root}reports/${date}.md`;
  writeFileSync(file, out.join('\n'));
  console.log(`Wrote reports/${date}.md (${top.length} shortlisted, ${rest.length} below the cut, ${dropped.length} dropped)`);
  console.log(out.slice(2, 6 + top.length).join('\n'));
  const reasons = new Map<string, number>();
  for (const d of dropped) {
    const key = d.reason.replace(/:.*$/, '');
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  if (reasons.size) console.log('Dropped: ' + [...reasons].map(([r, n]) => `${n} ${r}`).join(', '));

  if (!values['no-notify'] && process.platform === 'darwin') {
    const message = `${top.length} jobs shortlisted. Open reports/${date}.md`;
    try {
      execFileSync('osascript', ['-e', `display notification "${message}" with title "Job shortlist ready"`]);
    } catch {
      console.error('Could not show the notification.');
    }
  }
}

main();
