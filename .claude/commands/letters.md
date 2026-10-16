---
description: Write cover letters for the chosen job ids, one agent per job. Letters are saved to cover-letters/. Never sends or applies anywhere.
---

Write cover letters for these job ids: `$ARGUMENTS` (space or comma separated). Never send or apply anywhere. Do not read any file other than what a step names.

1. For each id, check that `matches/job-triage/<id>.json` exists (use `ls`, do not open it). If one is missing, say that id needs triage first and leave it out.
2. Launch one `cover-letter-writer` agent per remaining id, all at once, each with only its id. They are independent. Note the token usage reported for each run.
3. For each agent that reports a letter written, run `node scripts/mark-letter.ts <id>`.
4. Reply with:
   - a table: id, company, status (written or skipped and why), word count, file path
   - tokens used per letter and in total
   - one line: "Letters and briefs are in cover-letters/. Nothing was sent."
