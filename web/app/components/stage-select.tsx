'use client';

import { setStage } from '../actions';
import { STAGES } from '../../lib/stages';

// Saves as soon as a stage is picked. Without JavaScript the form still works
// through the Save button, which is hidden once the script runs.
export function StageSelect({ jobId, stage }: { jobId: string; stage: string }) {
  return (
    <form action={setStage} className="stage-form">
      <input type="hidden" name="jobId" value={jobId} />
      <select
        name="stage"
        defaultValue={stage}
        aria-label="Stage"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      <noscript><button type="submit">Save</button></noscript>
    </form>
  );
}
