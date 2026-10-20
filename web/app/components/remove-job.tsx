'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { removeJob } from '../actions';

function Confirm({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn danger" disabled={disabled || pending}>
      {pending ? 'Removing…' : 'Remove job'}
    </button>
  );
}

// Trash button plus a confirmation dialog that asks why the job is going.
// "Not interested" hides it for this person; "closed" deletes it from the database.
export function RemoveJob({ jobId, label }: { jobId: string; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');

  function open() {
    setReason('');
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" className="trash" onClick={open} aria-label={`Remove ${label}`} title="Remove job">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 14h10l1-14" />
          <path d="M10 10v6M14 10v6" />
        </svg>
      </button>
      <dialog ref={dialog} className="confirm" aria-labelledby={`remove-${jobId}`}>
        <form action={removeJob}>
          <input type="hidden" name="jobId" value={jobId} />
          <h2 id={`remove-${jobId}`}>Remove this job?</h2>
          <p className="muted">{label}</p>
          <fieldset>
            <legend>Why are you removing it?</legend>
            <label>
              <input type="radio" name="reason" value="not-interested" checked={reason === 'not-interested'} onChange={() => setReason('not-interested')} required />
              <span>Not interested<small>Hides it from your list. It stays in the database, so an import never brings it back.</small></span>
            </label>
            <label>
              <input type="radio" name="reason" value="closed" checked={reason === 'closed'} onChange={() => setReason('closed')} required />
              <span>The company no longer accepts applications<small>Deletes the job, its score, contacts and notes from the database for everyone. This cannot be undone.</small></span>
            </label>
          </fieldset>
          {reason === 'closed' && <p className="form-error" role="alert">This permanently deletes the job from the database.</p>}
          <div className="confirm-actions">
            <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
            <Confirm disabled={!reason} />
          </div>
        </form>
      </dialog>
    </>
  );
}
