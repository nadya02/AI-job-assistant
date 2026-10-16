// Weekly step 1, no LLM: import -> prefilter -> list the batches to triage.
// Run with:  npm run weekly:prepare [-- --skip-import] [-- --dry-run]
//
//   --skip-import  do not re-import jobs.json
//   --dry-run      the prefilter only prints, it does not mark jobs as skipped
//
// The last line printed is the batches as JSON: [["id","id",...],[...]].
// The /weekly command passes each batch to the job-triage agent.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const BATCH_SIZE = 20; // each triage run has a large fixed cost, so batches are big

const { values } = parseArgs({
  options: {
    'skip-import': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const root = fileURLToPath(new URL('../', import.meta.url));

function node(args: string[], capture = false): string {
  const out = execFileSync('node', args, { cwd: root, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
  return out ?? '';
}

if (!values['skip-import']) {
  console.log('--- import ---');
  node(['scripts/import-jobs.ts']);
}

console.log('--- prefilter ---');
node(['scripts/prefilter.ts', ...(values['dry-run'] ? ['--dry-run'] : [])]);

const ids: string[] = JSON.parse(node(['scripts/get-next-job.ts', '--list-ids'], true));
const batches: string[][] = [];
for (let i = 0; i < ids.length; i += BATCH_SIZE) batches.push(ids.slice(i, i + BATCH_SIZE));

console.log(`--- ${ids.length} jobs to triage in ${batches.length} batch(es) of up to ${BATCH_SIZE} ---`);
console.log(JSON.stringify(batches));
