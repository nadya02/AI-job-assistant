import { toggleSaved } from '../actions';

// Bookmark button: filled when the job is saved. Works without JavaScript.
export function SaveJob({ jobId, saved, label }: { jobId: string; saved: boolean; label: string }) {
  return (
    <form action={toggleSaved} className="save-form">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        className={saved ? 'trash save on' : 'trash save'}
        aria-label={`${saved ? 'Unsave' : 'Save'} ${label}`}
        aria-pressed={saved}
        title={saved ? 'Saved. Click to unsave' : 'Save job'}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
      </button>
    </form>
  );
}
