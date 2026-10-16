// Prints jobs as JSON. This is the only way agents read the Job table.
// Run with:  node scripts/get-next-job.ts [--id <jobId>] [--offset <n>]
//            node scripts/get-next-job.ts --batch <n> [--offset <n>]
//            node scripts/get-next-job.ts --ids <id,id,id>
//            node scripts/get-next-job.ts --list-ids      (ids of all pending jobs)
//
//   --id      that exact job (all fields)
//   --offset  skip the first n pending jobs (default 0), ordered by id
//   --batch   the next n pending jobs, trimmed for triage (short list of fields,
//             the benefits section removed, nothing else cut)
//   --ids     those exact jobs, trimmed like --batch, whatever their status

import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    ids: { type: 'string' },
    batch: { type: 'string' },
    offset: { type: 'string', default: '0' },
    'list-ids': { type: 'boolean', default: false },
  },
});

// Only the fields an agent needs. No hash, status or timestamps.
const select = {
  id: true,
  title: true,
  company: true,
  location: true,
  url: true,
  description: true,
  companyInfo: true,
  seniority: true,
  salary: true,
  postedAt: true,
  mentionGerman: true,
} as const;

// ---------- trimming (batch mode only) ----------

const KEEP_COMPANY = 600;

// The only thing cut from a description is the benefits section ("Benefits",
// "What we offer", "Wir bieten", ...). Everything else is kept as written.
const BENEFIT_HEADING =
  /benefits?|vorteile|perks|what we offer|we offer|what you get|was wir bieten|wir bieten|bei uns bekommst|unser angebot/i;
// A line inside a benefits section that talks about applying is kept anyway.
const KEEP_LINE =
  /\b(apply|application|cover letter|resume|cv|bewerb\w*|anschreiben|lebenslauf|video|portfolio|send us|schick\w*)\b/i;
// A real benefits section is short. A longer "section" means the heading
// detection went wrong, so nothing is removed.
const MAX_BENEFITS_CHARS = 2500;

function squash(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// A heading is a short line that is not a bullet and does not end like a sentence.
function isHeading(line: string): boolean {
  const t = line.trim();
  return t.length > 0 && t.length <= 60 && !/^[-•*·]/.test(t) && !/[.,;]$/.test(t);
}

function removeBenefits(text: string): { text: string; removed: boolean } {
  const lines = text.split('\n');
  const out: string[] = [];
  let removed = false;
  let i = 0;
  while (i < lines.length) {
    if (isHeading(lines[i]) && BENEFIT_HEADING.test(lines[i])) {
      // The section runs until the next heading that is not a benefits heading.
      let j = i + 1;
      while (
        j < lines.length &&
        !(isHeading(lines[j]) && !BENEFIT_HEADING.test(lines[j]) && lines[j - 1].trim() === '')
      ) {
        j++;
      }
      const section = lines.slice(i, j);
      if (section.join('\n').length <= MAX_BENEFITS_CHARS) {
        out.push('[benefits section removed]', ...section.filter((l) => KEEP_LINE.test(l)));
        removed = true;
        i = j;
        continue;
      }
    }
    out.push(lines[i]);
    i++;
  }
  return { text: out.join('\n'), removed };
}

type FullJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  companyInfo: string | null;
  seniority: string | null;
  postedAt: Date | null;
  mentionGerman: boolean;
};

function toBatchJob(job: FullJob) {
  const description = removeBenefits(squash(job.description));
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    seniority: job.seniority,
    postedAt: job.postedAt ? job.postedAt.toISOString().slice(0, 10) : null,
    mentionGerman: job.mentionGerman,
    companyInfo: job.companyInfo ? squash(job.companyInfo).slice(0, KEEP_COMPANY) : null,
    description: description.text,
    benefitsRemoved: description.removed,
  };
}

// ---------- main ----------

async function main() {
  const offset = Number(values.offset);

  if (values['list-ids']) {
    const rows = await prisma.job.findMany({
      where: { status: 'pending' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    console.log(JSON.stringify(rows.map((r) => r.id)));
    return;
  }

  if (values.batch || values.ids) {
    const jobs = values.ids
      ? await prisma.job.findMany({
          where: { id: { in: values.ids.split(',').map((s) => s.trim()) } },
          orderBy: { id: 'asc' },
          select,
        })
      : await prisma.job.findMany({
          where: { status: 'pending' },
          orderBy: { id: 'asc' },
          skip: offset,
          take: Number(values.batch),
          select,
        });
    if (jobs.length === 0) {
      console.error('No jobs found');
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(jobs.map(toBatchJob)));
    return;
  }

  const job = values.id
    ? await prisma.job.findUnique({ where: { id: values.id }, select })
    : (
        await prisma.job.findMany({
          where: { status: 'pending' },
          orderBy: { id: 'asc' },
          skip: offset,
          take: 1,
          select,
        })
      )[0] ?? null;

  if (!job) {
    console.error('No job found');
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(job, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
