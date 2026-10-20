import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getCurrentUser } from '../lib/current-user';
import { inStage, visibleTo } from '../lib/applications';
import { getPanelJob } from '../lib/panel-job';
import { latestLetterRuns } from '../lib/runner';
import { toRunView } from '../lib/run-view';
import { STAGES, stageLabel } from '../lib/stages';
import { isSkip, postedAgo } from '../lib/format';
import { JobPanel, tabFrom } from './components/job-panel';
import { MiniScore } from './components/score-bar';
import { RemoveJob } from './components/remove-job';
import { SaveJob } from './components/save-job';

// Always read fresh data: the import and triage scripts change the database
// outside of this app.
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

const SORTS = {
  rank: [{ match: { rank: { sort: 'desc', nulls: 'last' } } }, { postedAt: { sort: 'desc', nulls: 'last' } }],
  posted: [{ postedAt: { sort: 'desc', nulls: 'last' } }],
  company: [{ company: 'asc' }],
  stage: [{ company: 'asc' }], // re-sorted by stage below: stage is on Application, not Job
} satisfies Record<string, Prisma.JobOrderByWithRelationInput[]>;

type SortKey = keyof typeof SORTS;

const SORT_LABELS: Record<SortKey, string> = {
  rank: 'Match score',
  posted: 'Posted',
  company: 'Company',
  stage: 'Stage',
};

// Shown after adding a job that is already in the database.
const NOTICES: Record<string, string> = {
  existing: 'This posting was already in the database, so it was added to your list instead of making a copy.',
  listed: 'This job was already in your list.',
  restored: 'This job was in your removed jobs. It is back in your list.',
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = first(params.q).trim();
  const stage = first(params.stage);
  const letter = first(params.letter); // '' | 'yes' | 'no'
  const sort: SortKey = first(params.sort) in SORTS ? (first(params.sort) as SortKey) : 'rank';
  const tab = tabFrom(first(params.tab));
  const notice = NOTICES[first(params.notice)] ?? '';

  const user = await getCurrentUser();
  const and: Prisma.JobWhereInput[] = visibleTo(user.id);
  if (q) {
    and.push({
      OR: [
        { company: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (STAGES.some((s) => s.key === stage)) and.push(inStage(user.id, stage));
  if (letter === 'yes') and.push({ match: { letterPath: { not: null } } });
  if (letter === 'no') and.push({ OR: [{ match: null }, { match: { letterPath: null } }] });

  const [found, stageCounts, total] = await Promise.all([
    prisma.job.findMany({
      where: { AND: and },
      orderBy: SORTS[sort],
      include: { match: true, applications: { where: { userId: user.id } } },
    }),
    prisma.application.groupBy({ by: ['stage'], where: { userId: user.id, removed: false }, _count: true }),
    prisma.job.count({ where: { AND: visibleTo(user.id) } }),
  ]);
  // "new" is every visible job that has no later stage, including jobs with no Application row.
  const countOf = (key: string) =>
    key === 'new'
      ? total - stageCounts.filter((c) => c.stage !== 'new').reduce((n, c) => n + c._count, 0)
      : (stageCounts.find((c) => c.stage === key)?._count ?? 0);

  const jobs = found.map((job) => ({ ...job, stage: job.applications[0]?.stage ?? 'new' }));
  if (sort === 'stage') {
    const order = (key: string) => STAGES.findIndex((s) => s.key === key);
    jobs.sort((a, b) => order(a.stage) - order(b.stage)); // stable: company order is kept within a stage
  }

  // The open job: the one in the URL, else the first in the list.
  const selectedId = first(params.job) || jobs[0]?.id || '';
  const selected = selectedId ? await getPanelJob(user.id, selectedId) : null;
  const selectedRun = selected ? toRunView((await latestLetterRuns([selected.id])).get(selected.id)) : null;

  // Links keep the current filters and change only the open job or tab.
  function href(overrides: Record<string, string>): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q, stage, letter, sort: sort === 'rank' ? '' : sort, job: selectedId, tab: '', ...overrides })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/?${qs}` : '/';
  }

  const filtered = Boolean(q || stage || letter);

  return (
    <main>
      <header className="page-head">
        <div>
          <h1>Jobs</h1>
          <p className="subtitle">
            {total} {total === 1 ? 'job' : 'jobs'}
            {STAGES.filter((s) => s.key !== 'new' && countOf(s.key) > 0).map((s) => (
              <span key={s.key}> · {countOf(s.key)} {s.label.toLowerCase()}</span>
            ))}
          </p>
        </div>
        <Link href="/add" className="btn">+ Add job</Link>
      </header>

      {notice && <p className="notice" role="status">{notice}</p>}

      <form className="filters" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Search company, role, location" aria-label="Search" />
        <select name="stage" defaultValue={stage} aria-label="Stage">
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select name="letter" defaultValue={letter} aria-label="Letter status">
          <option value="">Any letter status</option>
          <option value="yes">Has a letter</option>
          <option value="no">No letter yet</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort by">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <option key={key} value={key}>Sort: {SORT_LABELS[key]}</option>
          ))}
        </select>
        <button type="submit" className="btn">Apply</button>
        {filtered && <Link href="/" className="link-quiet">Clear all</Link>}
      </form>

      {jobs.length === 0 ? (
        <p className="empty">
          {total === 0
            ? 'No jobs yet. Drop a scrape file into inbox/ with npm run watch running, or run npm run import.'
            : 'No jobs match these filters.'}
        </p>
      ) : (
        <div className="workspace">
          <ul className="list" aria-label="Jobs">
            {jobs.map((job) => (
              <li key={job.id} className="jitem">
                <Link href={href({ job: job.id })} scroll={false} className={job.id === selectedId ? 'jrow selected' : 'jrow'} aria-current={job.id === selectedId ? 'true' : undefined}>
                  <span className="jrow-main">
                    <span className="jrow-company">{job.company}</span>
                    <span className="jrow-title">{job.title}</span>
                    <span className="jrow-meta">
                      <span className={`pill stage-${job.stage}`}>{stageLabel(job.stage)}</span>
                      <span>{postedAgo(job.postedAt)}</span>
                    </span>
                  </span>
                  <span className="jrow-score">
                    {job.match?.rank != null ? (
                      <MiniScore score={job.match.rank} />
                    ) : (
                      <span className="not-scored">{job.match ? (isSkip(job.match.verdict) ? 'Skipped' : 'Not ranked') : 'Not scored yet'}</span>
                    )}
                  </span>
                </Link>
                <div className="row-actions">
                  <SaveJob jobId={job.id} saved={Boolean(job.applications[0]?.savedAt)} label={`${job.title} at ${job.company}`} />
                  <RemoveJob jobId={job.id} label={`${job.title} at ${job.company}`} />
                </div>
              </li>
            ))}
          </ul>
          {selected && <JobPanel job={selected} tab={tab} tabHref={(t) => href({ tab: t === 'description' ? '' : t })} run={selectedRun} />}
        </div>
      )}
    </main>
  );
}
