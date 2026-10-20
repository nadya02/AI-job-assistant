'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { requestLetter } from '../actions';
import { CopyText } from './copy-text';

export interface RunView {
  status: string;
  startedAt: string | null;
  summary: string | null;
  error: string | null;
}

// The letter control in the detail panel: a button when nothing is running, a
// progress line while it runs (the page refreshes itself until it finishes),
// and the reason when a run failed or ended without a letter.
export function RunStatus({
  jobId, hasLetter, hasMatch, run, triagePrompt,
}: { jobId: string; hasLetter: boolean; hasMatch: boolean; run: RunView | null; triagePrompt: string }) {
  const router = useRouter();
  const active = run?.status === 'queued' || run?.status === 'running';

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [active, router]);

  if (hasLetter) return null;

  if (active) {
    const since = run?.startedAt ? Math.max(0, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 60000)) : 0;
    return (
      <p className="run-note" role="status">
        {run?.status === 'queued' ? 'Waiting for a free slot to write the letter…' : `Writing the letter… ${since < 1 ? 'under a minute' : `${since} min`} so far. This takes a couple of minutes.`}
      </p>
    );
  }

  if (!hasMatch) {
    return (
      <div className="run-note">
        <p>This job is not scored yet, and a letter needs the score first. Scoring runs in Claude Code. Paste this there:</p>
        <p><code>{triagePrompt}</code></p>
        <CopyText text={triagePrompt} label="Copy" />
      </div>
    );
  }

  return (
    <div className="run-note">
      {run?.status === 'failed' && <p className="run-error" role="alert">The last letter run failed: {run.error}</p>}
      {run?.status === 'done' && <p>The last run finished without saving a letter. {run.summary}</p>}
      {run?.status === 'done' && run.error && <p className="run-error">{run.error}</p>}
      <form action={requestLetter}>
        <input type="hidden" name="jobId" value={jobId} />
        <button type="submit" className="btn">{run ? 'Try again' : 'Create cover letter'}</button>
      </form>
    </div>
  );
}
