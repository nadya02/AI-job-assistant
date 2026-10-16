// Imports jobs.json (LinkedIn scrape) into the Job table.
// Run with:  npm run import
//
// Steps: read file -> clean + map each record -> drop duplicates -> insert.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type Prisma } from '@prisma/client';
import { skipGerman, softGerman } from './filter-german.ts';

const prisma = new PrismaClient();

// Resolve jobs.json relative to this script, so it works from any cwd.
const JOBS_FILE = fileURLToPath(new URL('../jobs.json', import.meta.url));

// ---------- types ----------

// The fields we use from one record of jobs.json (the scraper has many more).
interface RawJob {
  id: string;
  title: string;
  companyName: string;
  location: string;
  link: string;
  descriptionText: string;
  companyDescription?: string;
  seniorityLevel?: string;
  salary?: string;
  postedAt?: string;
}

// One row of the Job table, as Prisma expects it for an insert.
type JobRow = Prisma.JobCreateManyInput;

// ---------- cleaning helpers ----------

// Query params that only exist for LinkedIn's own click tracking.
const TRACKING_PARAMS = ['refId', 'trackingId', 'position', 'pageNum', 'trk', 'trkInfo'];

// "" / "   " / undefined -> null, otherwise the trimmed string.
function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

// Turn HTML entities back into characters. &amp; is decoded LAST, otherwise
// "&amp;lt;" would be decoded twice and become "<" instead of "&lt;".
function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// "Berlin, Berlin, Germany" -> "Berlin, Germany": split on commas and keep
// each part only the first time it appears (case-insensitive).
function dedupeLocation(text: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const part of text.split(',').map((p) => p.trim())) {
    if (part === '' || seen.has(part.toLowerCase())) continue;
    seen.add(part.toLowerCase());
    parts.push(part);
  }
  return parts.join(', ');
}

// Remove tracking params (and utm_*) but keep any other query params.
function cleanUrl(raw: string): string {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.includes(key) || key.startsWith('utm_')) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

// Same company + same description => same job posted twice (different LinkedIn id).
function computeContentHash(company: string, description: string): string {
  return createHash('sha256')
    .update(company.toLowerCase() + '\n' + description)
    .digest('hex');
}

// ---------- mapping: one raw scraped record -> one Job row ----------

function toJobRow(raw: RawJob): JobRow {
  const company = decodeEntities(raw.companyName).trim();
  const description = decodeEntities(raw.descriptionText).trim();

  // LinkedIn uses "Not Applicable" when a posting has no seniority; that is "unknown".
  let seniority = emptyToNull(raw.seniorityLevel);
  if (seniority === 'Not Applicable') seniority = null;

  // German filter: a hard requirement => skipped, a soft mention => just flagged.
  const skipPhrase = skipGerman(description);
  const softPhrase = softGerman(description);

  return {
    id: String(raw.id),
    title: decodeEntities(raw.title).trim(),
    company,
    location: dedupeLocation(decodeEntities(raw.location)),
    url: cleanUrl(raw.link),
    description,
    companyInfo: emptyToNull(raw.companyDescription && decodeEntities(raw.companyDescription)),
    seniority,
    salary: emptyToNull(raw.salary),
    postedAt: raw.postedAt ? new Date(raw.postedAt) : null,
    contentHash: computeContentHash(company, description),
    mentionGerman: Boolean(skipPhrase || softPhrase),
    status: skipPhrase ? 'skipped' : 'pending',
    skipReason: skipPhrase ? `German required: "${skipPhrase}"` : null,
    // createdAt, updatedAt: left to the schema defaults
  };
}

// ---------- main ----------

async function main() {
  const rawJobs: RawJob[] = JSON.parse(readFileSync(JOBS_FILE, 'utf8'));
  console.log(`Read ${rawJobs.length} records from jobs.json`);

  const rows: JobRow[] = [];
  const seenIds = new Set<string>();
  const seenHashes = new Set<string>();
  let skippedInFile = 0;
  let skippedGerman = 0;

  for (const raw of rawJobs) {
    const row = toJobRow(raw);

    // German required => drop the job, do not store it.
    if (row.status === 'skipped') {
      console.log(`  skip German required:   ${row.id} (${row.company} - ${row.title}) ${row.skipReason}`);
      skippedGerman++;
      continue;
    }

    if (seenIds.has(row.id) || seenHashes.has(row.contentHash)) {
      console.log(`  skip duplicate in file: ${row.id} (${row.company} - ${row.title})`);
      skippedInFile++;
      continue;
    }
    seenIds.add(row.id);
    seenHashes.add(row.contentHash);
    rows.push(row);
  }

  // skipDuplicates => "INSERT ... ON CONFLICT DO NOTHING": rows whose id or
  // contentHash is already in the DB are ignored, so re-running is safe.
  const result = await prisma.job.createMany({ data: rows, skipDuplicates: true });

  console.log(`Duplicates inside file:  ${skippedInFile}`);
  console.log(`German required:        ${skippedGerman}`);
  console.log(`Already in database:    ${rows.length - result.count}`);
  console.log(`Inserted:               ${result.count}`);
  console.log(`Rows in Job table now:  ${await prisma.job.count()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
