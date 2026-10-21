# AI Job Assistant

Scrapes LinkedIn jobs into Postgres, triages them against a candidate profile, and drafts cover letters. A Next.js tracker in `web/` shows the jobs and tracks applications.

It never applies to anything or sends anything. Letters are only saved to files, and the site's Apply button just opens the job URL.

## How it works

1. A LinkedIn scrape (JSON) is dropped into `inbox/`. `npm run watch` imports it, drops jobs that require German, and de-duplicates by content hash.
2. `/weekly` prefilters the jobs, then runs the `job-triage` agent in batches. Each job is scored (fit, interest, verdict) against the candidate profile using `scoring-guides.md`. Results are saved to the `Match` table.
3. `npm run rank` writes the shortlist to `reports/<date>.md`.
4. You pick jobs. `/letters <ids>` runs the `cover-letter-writer` agent per job and saves letters to `cover-letters/`.
5. The tracker site (`web/`) shows jobs, stages, contacts and letters from the same database.

More detail in [docs/overview.md](docs/overview.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `.claude/agents/` | `job-triage` and `cover-letter-writer` agents |
| `.claude/commands/` | `/weekly`, `/letters`, `/web`, `/agents` |
| `scripts/` | Pipeline scripts (import, prefilter, triage, rank, save-match, mark-letter, ...) |
| `prisma/schema.prisma` | Postgres schema |
| `web/` | Next.js job tracker |
| `docs/` | Overview, data model, web status and decisions |
| `profile/` | Candidate info and style guide (git-ignored) |

## Setup

Requirements: Node.js, Docker, and [Claude Code](https://claude.com/claude-code).

```bash
npm install
npm --prefix web install
npm run db:up      # start Postgres via Docker
npm run db:push    # apply the Prisma schema
```

Create a `.env` with your database connection string, and add your own files under `profile/` (skills card, interests, style guide).

## Usage

```bash
npm run watch      # import scrapes dropped into inbox/
npm run rank       # write the shortlist report
npm run web        # start the tracker site
```

In Claude Code:

- `/weekly` runs import, prefilter, triage and ranking.
- `/letters <ids>` writes cover letters for the chosen jobs.
- `/agents` and `/web` switch between pipeline work and tracker-site work.

## Privacy

Personal data (profile, letters, matches, reports, job data) is git-ignored. Check `.gitignore` before committing.
