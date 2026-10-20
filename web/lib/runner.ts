import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prisma } from './prisma';
import { projectRoot } from './paths';
import { visibleTo } from './applications';

// Runs Claude Code headless (`claude -p`) for work the site cannot do itself.
//
// Permissions: a headless run cannot ask anyone to approve a tool, so each kind
// of run gets a short allowlist and everything else is refused (tested: a tool
// that is not listed is denied, it does not hang). No MCP servers are loaded, so
// connectors such as Gmail are out of reach. The prompt contains only a job id
// that was checked against the database, never text from a job posting.
//
// Triage is NOT here on purpose: the triage agent saves its scores through a
// JSON heredoc, which Claude Code's injection guard rejects in headless mode
// whatever is allowed. See docs/web-status.md.

export type RunKind = 'letter';

const MAX_PARALLEL = 2;
const TIMEOUT_MS = 15 * 60_000;

interface Spec {
  prompt: string;
  tools: string[];
  budgetUsd: number;
}

function specFor(kind: RunKind, jobId: string): Spec {
  switch (kind) {
    case 'letter':
      return {
        // The existing command: checks the triage file, launches cover-letter-writer, runs mark-letter.
        prompt: `/letters ${jobId}`,
        tools: [
          'Agent',
          'Read',
          'Edit(/cover-letters/**)', // project-root path; also covers the Write tool
          'Bash(node scripts/get-next-job.ts:*)',
          'Bash(node scripts/mark-letter.ts:*)',
          'Bash(ls:*)',
        ],
        budgetUsd: 2,
      };
  }
}

// CLAUDE_BIN wins; then `claude` on PATH; then the copy bundled in the VS Code extension.
export function findClaude(): string | null {
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv) return existsSync(fromEnv) ? fromEnv : null;

  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.join(dir, 'claude');
    if (dir && existsSync(candidate)) return candidate;
  }

  const extDir = path.join(os.homedir(), '.vscode', 'extensions');
  if (existsSync(extDir)) {
    const versions = readdirSync(extDir)
      .filter((d) => d.startsWith('anthropic.claude-code-'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .reverse();
    for (const d of versions) {
      const candidate = path.join(extDir, d, 'resources', 'native-binary', 'claude');
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

// In-process queue. Kept on globalThis so a dev-server hot reload does not lose it.
interface RunnerState {
  active: Map<number, ChildProcess>;
  queue: number[];
}
const g = globalThis as unknown as { __runner?: RunnerState };
const state: RunnerState = (g.__runner ??= { active: new Map(), queue: [] });

const ACTIVE = ['queued', 'running'];

export async function startRun(
  userId: number,
  jobId: string,
  kind: RunKind,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Only a job this person can see, and (for a letter) only one that has been triaged.
  const job = await prisma.job.findFirst({
    where: { AND: [{ id: jobId }, ...visibleTo(userId)] },
    include: { match: true },
  });
  if (!job) return { ok: false, error: 'Job not found.' };
  if (!/^\d+$/.test(job.id)) return { ok: false, error: 'This job id is not in the numeric form the pipeline needs.' };
  if (kind === 'letter') {
    if (!job.match) return { ok: false, error: 'Score this job first: a letter needs the triage result.' };
    if (job.match.letterPath) return { ok: false, error: 'This job already has a letter.' };
  }

  await reconcile();
  const busy = await prisma.run.findFirst({ where: { jobId, kind, status: { in: ACTIVE } } });
  if (busy) return { ok: false, error: 'A run for this job is already in progress.' };

  const run = await prisma.run.create({ data: { userId, jobId, kind } });
  state.queue.push(run.id);
  pump();
  return { ok: true };
}

function pump() {
  while (state.active.size < MAX_PARALLEL && state.queue.length > 0) {
    const id = state.queue.shift()!;
    void launch(id);
  }
}

async function finish(runId: number, data: { status: 'done' | 'failed'; summary?: string | null; error?: string | null; costUsd?: number | null }) {
  state.active.delete(runId);
  await prisma.run.update({ where: { id: runId }, data: { ...data, finishedAt: new Date() } });
  pump();
}

async function launch(runId: number) {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run || !run.jobId) return finish(runId, { status: 'failed', error: 'Run or job missing.' });

  const bin = findClaude();
  if (!bin) {
    return finish(runId, {
      status: 'failed',
      error: 'Claude Code was not found. Install it, or set CLAUDE_BIN to its full path, then restart the site.',
    });
  }

  const spec = specFor(run.kind as RunKind, run.jobId);
  await prisma.run.update({ where: { id: runId }, data: { status: 'running', startedAt: new Date() } });

  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--model', 'sonnet',
    '--max-budget-usd', String(spec.budgetUsd),
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--allowedTools', spec.tools.join(','),
  ];

  let child: ChildProcess;
  try {
    // No shell, and the prompt goes in on stdin, so nothing is parsed as a command line.
    child = spawn(bin, args, { cwd: projectRoot(), stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    return finish(runId, { status: 'failed', error: `Could not start Claude Code: ${(err as Error).message}` });
  }
  state.active.set(runId, child);
  child.stdin?.end(spec.prompt);

  let out = '';
  let err = '';
  child.stdout?.on('data', (d) => (out += d));
  child.stderr?.on('data', (d) => (err += d));
  const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);

  child.on('error', (e) => {
    clearTimeout(timer);
    void finish(runId, { status: 'failed', error: `Could not start Claude Code: ${e.message}` });
  });

  child.on('close', (code, signal) => {
    clearTimeout(timer);
    if (!state.active.has(runId)) return; // already finished through the error handler
    let result: { result?: string; is_error?: boolean; total_cost_usd?: number; permission_denials?: { tool_name?: string; tool_input?: { command?: string; file_path?: string } }[] } | null = null;
    try {
      result = JSON.parse(out);
    } catch {
      // not JSON: fall through to the failure branch with whatever was printed
    }
    const denied = (result?.permission_denials ?? []).map((d) => `${d.tool_name}: ${d.tool_input?.command ?? d.tool_input?.file_path ?? ''}`.slice(0, 160));
    const deniedNote = denied.length ? `Refused tools: ${denied.join('; ')}` : null;

    if (signal) {
      return void finish(runId, { status: 'failed', error: `Stopped after ${TIMEOUT_MS / 60000} minutes.` });
    }
    if (code !== 0 || !result || result.is_error) {
      const reason = (result?.result ?? (err || out).trim()).slice(0, 1500) || `Claude Code exited with code ${code}.`;
      return void finish(runId, { status: 'failed', error: [reason, deniedNote].filter(Boolean).join('\n'), costUsd: result?.total_cost_usd ?? null });
    }
    void finish(runId, { status: 'done', summary: (result.result ?? '').slice(0, 4000), error: deniedNote, costUsd: result.total_cost_usd ?? null });
  });
}

// A run marked queued or running that this process knows nothing about was
// interrupted (the site was restarted). Mark it failed so the page does not wait forever.
export async function reconcile() {
  const stale = await prisma.run.findMany({ where: { status: { in: ACTIVE } }, select: { id: true } });
  const lost = stale.filter((r) => !state.active.has(r.id) && !state.queue.includes(r.id)).map((r) => r.id);
  if (lost.length) {
    await prisma.run.updateMany({
      where: { id: { in: lost } },
      data: { status: 'failed', error: 'Interrupted: the site was restarted while this was running.', finishedAt: new Date() },
    });
  }
}

export interface RunInfo {
  status: string;
  startedAt: Date | null;
  summary: string | null;
  error: string | null;
  costUsd: number | null;
}

// The latest letter run for each job, after cleaning up interrupted ones.
export async function latestLetterRuns(jobIds: string[]): Promise<Map<string, RunInfo>> {
  await reconcile();
  const runs = await prisma.run.findMany({
    where: { kind: 'letter', jobId: { in: jobIds } },
    orderBy: { id: 'desc' },
  });
  const latest = new Map<string, RunInfo>();
  for (const r of runs) {
    if (r.jobId && !latest.has(r.jobId)) {
      latest.set(r.jobId, { status: r.status, startedAt: r.startedAt, summary: r.summary, error: r.error, costUsd: r.costUsd });
    }
  }
  return latest;
}
