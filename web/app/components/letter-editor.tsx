'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveLetter } from '../actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn primary small" disabled={pending}>{pending ? 'Saving…' : 'Save letter'}</button>;
}

// "Edit" button that swaps the rendered letter for a textarea with the file's text.
// `children` is the rendered letter, shown while not editing.
export function LetterEditor({ jobId, letter, children }: { jobId: string; letter: string; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <>
        <button type="button" className="btn small" onClick={() => setEditing(true)}>Edit letter</button>
        {children}
      </>
    );
  }

  return (
    <form
      action={async (form) => {
        await saveLetter(form);
        setEditing(false);
      }}
      className="letter-edit"
    >
      <input type="hidden" name="jobId" value={jobId} />
      <textarea name="letter" defaultValue={letter.trim()} rows={18} maxLength={20000} aria-label="Letter text" required />
      <p className="hint">Saved straight to the letter file. Blank lines separate paragraphs, **bold** works.</p>
      <div className="confirm-actions">
        <button type="button" className="btn small" onClick={() => setEditing(false)}>Cancel</button>
        <SaveButton />
      </div>
    </form>
  );
}
