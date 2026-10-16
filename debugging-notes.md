# Debugging an app that won't load

## The 5 steps

1. **Is it running?** `pgrep -fl <app>` or Activity Monitor.
2. **Find the log.** `~/Library/Logs/<App>/`, `~/Library/Containers/<bundle-id>/Data/log/`, or Console app.
   - Not sure where? `ls -lt <folder>` and open the file changed in the last few minutes.
3. **Filter, don't read.**
   ```
   grep -i -E "error|fail|fatal|panic|denied|timeout|refused" file.log | head -40
   tail -n 50 file.log
   ```
4. **Find the FIRST error** near the time you launched. Ignore lines that repeat every few seconds ("still waiting...") - those are symptoms.
5. **Change one thing, retry, re-check the same log.**

## What the result tells you

| You see | It means | Try |
|---|---|---|
| `Permission denied` / `sudo: a password is required` | Needs admin rights | Run the command in your own terminal |
| `Address already in use` / port busy | Another program owns the port | `lsof -i :5432` to see who, then stop it or change the port |
| `No such file or directory` | Missing path or file | Check the path, reinstall |
| `Connection refused` / `can't reach database` | Service isn't running | Start it (`npm run db:up`), check Docker is up |
| `command not found` | Tool not installed or not on PATH | `brew install <tool>`, or fix PATH |
| `timeout` | Something hung or is too slow | Check CPU/memory/disk, restart |
| Same warning repeating forever | Symptom, not cause | Scroll up to the first error |

## Quick checks

- Disk space: `df -h /`
- What's on a port: `lsof -i :PORT`
- Docker engine up?: `docker info`
- Container output: `docker logs ai-job-assistant-db`
- Database running?: `docker exec ai-job-assistant-db pg_isready -U jobs`

## Docker Desktop (Mac) specifics

- Log: `~/Library/Containers/com.docker.docker/Data/log/host/com.docker.backend.log`
- Settings: `~/Library/Group Containers/group.com.docker/settings-store.json`
- Stuck on "starting engine": `grep -i -E "error|stopReason" <log>`
- Our case: `Failed to install Rosetta` -> set `"UseVirtualizationFrameworkRosetta": false`, quit and reopen Docker.

## Errors in your own code

- **Node stack trace:** read the top line (the message), then the first line that mentions *your* file, e.g. `scripts/import-jobs.js:42`.
- **Prisma error codes** (e.g. `P1001` can't reach DB, `P2002` unique constraint failed): search the code in Prisma's docs.

## Last resort order

Quit fully -> relaunch -> check logs again -> search the exact error text + app name -> reinstall.
