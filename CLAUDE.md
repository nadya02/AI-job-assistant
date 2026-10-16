Generates cover letters for scraped jobs. Jobs live in Postgres. Letters go to `cover-letters/`

Never read the jobs table directly. Use `get-next-job.ts` and `save-match.ts`.

Never send or apply anywhere. Letters are only saved to files.

Don’t re-read a file you already read in the same run.