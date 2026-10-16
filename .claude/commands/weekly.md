---
description: Weekly job run. Import, prefilter, triage in batches, rank, and write the shortlist report. Never writes letters or applies anywhere.
---

Run the weekly job pipeline. Follow the steps in order. Do not write cover letters. Never send or apply anywhere. Do not read any file other than what a step names.

1. Run `npm run weekly:prepare`. If the user passed arguments (`$ARGUMENTS`), add them after `--`. Read the last line of its output: the batches, as JSON.
   - If there are no jobs to triage, say so and stop.
2. For each batch, one after another, launch the `job-triage` agent with the batch's ids (`--ids a,b,c`). Wait for each to finish before the next. Do not triage a job twice. Note the token usage reported for each run.
   - If a batch fails, say which ids failed and continue with the next batch.
3. Run `npm run rank`. It writes `reports/<date>.md` and shows a macOS notification.
4. Reply with:
   - the shortlist table from the report (company, role, rank, fit, interest, verdict, job id)
   - how many jobs were imported, prefiltered, triaged, and dropped, with the main reasons (for example German required)
   - tokens used per triage batch and in total
   - one line: "Pick the jobs to write letters for."

Do not open the report file to re-read it; the rank script prints the summary.
