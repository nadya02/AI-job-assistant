'use client';

import { useActionState } from 'react';
import { addJob } from '../actions';
import { STAGES } from '../../lib/stages';
import type { AddJobState } from '../../lib/add-job';

export function AddJobForm() {
  const [state, action, pending] = useActionState<AddJobState, FormData>(addJob, {});
  const v = (key: string) => state.values?.[key] ?? '';

  return (
    <form action={action} className="add-form">
      {state.error && <p className="form-error" role="alert">{state.error}</p>}

      <div className="field-row">
        <label><span>Company <span className="req">required</span></span>
          <input name="company" defaultValue={v('company')} required />
        </label>
        <label><span>Job title <span className="req">required</span></span>
          <input name="title" defaultValue={v('title')} required />
        </label>
      </div>

      <label><span>Link to the posting <span className="req">required</span></span>
        <input name="url" type="url" defaultValue={v('url')} placeholder="https://" required />
        <span className="hint">The Apply button opens this link. Nothing is sent anywhere.</span>
      </label>

      <label><span>Job description <span className="req">required</span></span>
        <textarea name="description" rows={10} defaultValue={v('description')} required />
      </label>

      <div className="field-row">
        <label>Location
          <input name="location" defaultValue={v('location')} placeholder="Berlin" />
        </label>
        <label>Salary
          <input name="salary" defaultValue={v('salary')} placeholder="80–95k EUR" />
        </label>
        <label>Seniority
          <input name="seniority" defaultValue={v('seniority')} placeholder="Mid" />
        </label>
      </div>

      <div className="field-row">
        <label>Posted on
          <input name="postedAt" type="date" defaultValue={v('postedAt')} />
          <span className="hint">Leave empty for today.</span>
        </label>
        <label>Stage
          <select name="stage" defaultValue={v('stage') || 'new'}>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <span className="hint">Pick Applied if you already applied.</span>
        </label>
      </div>

      <label>Benefits
        <input name="benefits" defaultValue={v('benefits')} />
      </label>
      <label>Notes
        <textarea name="notes" rows={3} defaultValue={v('notes')} />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={pending}>{pending ? 'Adding…' : 'Add job'}</button>
        <a href="/" className="link-quiet">Cancel</a>
      </div>
    </form>
  );
}
