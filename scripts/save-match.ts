// Saves match results as files. Reads JSON from stdin.
//
//   one job:   cat result.json | node scripts/save-match.ts <jobId> --agent <name>
//   a batch:   cat results.json | node scripts/save-match.ts --batch --agent <name> [--no-mark]
//
// Writes matches/<agentName>/<jobId>.json. Results are kept per agent so two
// agents can match the same job without overwriting each other.
//
// Batch mode takes a JSON array where each item has a job_id. It also sets the
// job's status to 'matched' so the job is never triaged twice. Pass --no-mark
// for test runs that should leave the status alone. The Match table is not used.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PrismaClient } from '@prisma/client';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    agent: { type: 'string' },
    batch: { type: 'boolean', default: false },
    'no-mark': { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const agent = values.agent;
if (!agent || !/^[a-z0-9-]+$/.test(agent)) {
  fail('--agent must be lowercase letters, digits and dashes');
}

let data: unknown;
try {
  data = JSON.parse(readFileSync(0, 'utf8'));
} catch (err) {
  fail(`stdin is not valid JSON: ${(err as Error).message}`);
}

const dir = fileURLToPath(new URL(`../matches/${agent}/`, import.meta.url));
mkdirSync(dir, { recursive: true });

function writeOne(jobId: string, body: object) {
  writeFileSync(`${dir}${jobId}.json`, JSON.stringify({ jobId, agent, ...body }, null, 2) + '\n');
  console.log(`saved matches/${agent}/${jobId}.json`);
}

async function main() {
  if (!values.batch) {
    const jobId = positionals[0];
    if (!jobId || !/^\d+$/.test(jobId)) fail('Usage: save-match.ts <jobId> --agent <name>');
    if (typeof data !== 'object' || data === null || Array.isArray(data)) fail('JSON must be an object');
    writeOne(jobId, data);
    return;
  }

  if (!Array.isArray(data) || data.length === 0) fail('Batch JSON must be a non-empty array');
  const ids: string[] = [];
  for (const item of data) {
    const jobId = String((item as { job_id?: unknown })?.job_id ?? '');
    if (!/^\d+$/.test(jobId)) fail(`Item without a numeric job_id: ${JSON.stringify(item).slice(0, 120)}`);
    writeOne(jobId, item as object);
    ids.push(jobId);
  }

  if (values['no-mark']) return;
  const prisma = new PrismaClient();
  try {
    const result = await prisma.job.updateMany({
      where: { id: { in: ids }, status: 'pending' },
      data: { status: 'matched' },
    });
    console.log(`marked ${result.count} jobs as matched`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
