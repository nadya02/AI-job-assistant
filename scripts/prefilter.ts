// Drops pending jobs that are not worth spending tokens on. No LLM.
// Run with:  npm run prefilter            (applies the changes)
//            npm run prefilter -- --dry-run   (only prints what would happen)
//
// A dropped job gets status 'skipped' and a skipReason, so it is never triaged.
// Rules: posted too long ago, or in an excluded industry (profile/interests.md).

import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';

const MAX_AGE_DAYS = 45;

// Matched against title, company, companyInfo and description. Kept to phrases
// that clearly mean the defense industry, so "cyber defense" and "self-defense"
// do not match on their own.
const EXCLUDED_PATTERNS: RegExp[] = [
  /\bweapons?\b/i,
  /\bmilitary\b/i,
  /\barmed forces\b/i,
  /\bbundeswehr\b/i,
  /\bwarfare\b/i,
  /\bdefen[cs]e (industry|sector|technology|tech|contractor|company|market)\b/i,
  /\bnational (security|defen[cs]e)\b/i,
  /\brüstung/i,
];

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const prisma = new PrismaClient();

function ageInDays(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

async function main() {
  const jobs = await prisma.job.findMany({
    where: { status: 'pending' },
    select: { id: true, title: true, company: true, companyInfo: true, description: true, postedAt: true },
  });

  const drops: { id: string; label: string; reason: string }[] = [];
  for (const job of jobs) {
    const label = `${job.company} - ${job.title}`;
    if (job.postedAt && ageInDays(job.postedAt) > MAX_AGE_DAYS) {
      drops.push({ id: job.id, label, reason: `posted ${ageInDays(job.postedAt)} days ago (limit ${MAX_AGE_DAYS})` });
      continue;
    }
    const haystack = `${job.title}\n${job.company}\n${job.companyInfo ?? ''}\n${job.description}`;
    const hit = EXCLUDED_PATTERNS.find((p) => p.test(haystack));
    if (hit) {
      const phrase = haystack.match(hit)?.[0] ?? hit.source;
      drops.push({ id: job.id, label, reason: `excluded industry: "${phrase}"` });
    }
  }

  console.log(`Pending jobs: ${jobs.length}`);
  for (const d of drops) console.log(`  drop ${d.id}  ${d.label}  (${d.reason})`);
  console.log(`Kept for triage: ${jobs.length - drops.length}`);

  if (values['dry-run']) {
    console.log('Dry run: nothing changed.');
    return;
  }
  for (const d of drops) {
    await prisma.job.update({ where: { id: d.id }, data: { status: 'skipped', skipReason: d.reason } });
  }
  console.log(`Marked ${drops.length} jobs as skipped.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
