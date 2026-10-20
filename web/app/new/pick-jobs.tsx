'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { requestLetters } from '../actions';
import { postedAgo } from '../../lib/format';

export interface NewJob {
  id: string;
  company: string;
  title: string;
  location: string;
  postedAt: string | null;
  rank: number | null;
}

// Left: the list with checkboxes. Right: the open job (rendered by the server
// and passed in as children). Clicking a row opens it; the checkbox picks it.
export function PickJobs({ jobs, selectedId, runStatus, children }: { jobs: NewJob[]; selectedId: string; runStatus: Record<string, string>; children: React.ReactNode }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  // Jobs with a letter in progress cannot be picked again; the list refreshes until they finish.
  const busy = (id: string) => runStatus[id] === 'queued' || runStatus[id] === 'running';
  const anyBusy = jobs.some((j) => busy(j.id));
  useEffect(() => {
    if (!anyBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [anyBusy, router]);

  const change = (next: Set<string>) => {
    setCopied(false);
    setPicked(next);
  };
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    change(next);
  };

  const ids = jobs.filter((j) => picked.has(j.id) && !busy(j.id)).map((j) => j.id);
  // Fallback if the site cannot start Claude Code: the same work as a command to paste there.
  const command = `/letters ${ids.join(' ')}`;

  function start() {
    setMessage('');
    startTransition(async () => {
      const r = await requestLetters(ids);
      setPicked(new Set());
      setMessage(
        r.started > 0
          ? `Started ${r.started} ${r.started === 1 ? 'letter' : 'letters'}. They appear in each job's Letter tab when done.${r.errors.length ? ` Not started: ${r.errors.join(' ')}` : ''}`
          : `Nothing started. ${r.errors.join(' ')}`,
      );
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      window.prompt('Copy this command', command);
    }
  }

  return (
    <div className="workspace wide">
      <div className="pick">
        <div className="list pick-list">
          <p className="pick-head"><span>Company and role, best match first</span><span>Location</span><span>Match score</span></p>
          <ul>
            {jobs.map((job) => {
              const on = picked.has(job.id);
              return (
                <li key={job.id} className={job.id === selectedId ? 'prow selected' : on ? 'prow picked' : 'prow'}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={on}
                    onChange={() => toggle(job.id)}
                    disabled={busy(job.id)}
                    aria-label={`Select ${job.company}, ${job.title}`}
                  />
                  <Link href={`/new?job=${encodeURIComponent(job.id)}`} scroll={false} className="prow-link" aria-current={job.id === selectedId ? 'true' : undefined}>
                    <span className="jrow-main">
                      <span className="jrow-company">{job.company}</span>
                      <span className="jrow-title">{job.title}</span>
                      {busy(job.id) && <span className="meta">Writing letter…</span>}
                      {runStatus[job.id] === 'failed' && <span className="meta run-error">Last letter run failed</span>}
                    </span>
                    <span className="prow-loc">
                      <span>{job.location}</span>
                      <span className="meta">{postedAgo(job.postedAt ? new Date(job.postedAt) : null)}</span>
                    </span>
                    <span className="prow-score">{job.rank !== null ? job.rank.toFixed(1) : '—'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="pick-bar">
          <span className="count-label">{picked.size} selected</span>
          <button type="button" className="link-bar" onClick={() => change(new Set(jobs.slice(0, 5).map((j) => j.id)))}>Select top 5</button>
          <button type="button" className="link-bar" onClick={() => change(new Set())}>Clear</button>
          <button type="button" className="btn accent" disabled={ids.length === 0 || pending} onClick={start}>
            {pending ? 'Starting…' : ids.length === 0 ? 'Select jobs for letters' : `Create cover letter${ids.length === 1 ? '' : 's'} for ${ids.length} ${ids.length === 1 ? 'job' : 'jobs'}`}
          </button>
        </div>
        {message && <p className="hint" role="status">{message}</p>}
        {ids.length > 0 && (
          <p className="hint">
            Prefer Claude Code? <button type="button" className="link-quiet-btn" onClick={copy}>{copied ? 'Command copied' : 'Copy the command instead'}</button>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
