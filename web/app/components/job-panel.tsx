import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { addContact, deleteContact, removeJob, saveNotes } from '../actions';
import { gapKind, isStrong, parseGaps, parseSkills, postedAgo } from '../../lib/format';
import { ScoreBar } from './score-bar';
import { StageSelect } from './stage-select';
import { RunStatus, type RunView } from './run-status';
import { LetterView } from './letter-view';
import { readLetter } from '../../lib/letters';

export type PanelJob = Prisma.JobGetPayload<{
  include: { match: true; applications: { include: { contacts: true } } };
}>;

export const TABS = [
  { key: 'description', label: 'Job description' },
  { key: 'company', label: 'Company' },
  { key: 'letter', label: 'Letter' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'notes', label: 'Notes' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export function tabFrom(value: string): TabKey {
  return TABS.some((t) => t.key === value) ? (value as TabKey) : 'description';
}

// The detail panel. `applications` holds only the current user's row (the page
// asks for it that way), so everything personal here belongs to them.
export async function JobPanel({ job, tab, tabHref, run }: { job: PanelJob; tab: TabKey; tabHref: (tab: TabKey) => string; run: RunView | null }) {
  const app = job.applications[0];
  const match = job.match;
  const skills = parseSkills(match?.topSkills ?? null);
  const gaps = parseGaps(match?.gaps ?? null);
  const contacts = app?.contacts ?? [];
  const letterPath = match?.letterPath ?? null;
  // The Letter tab exists only for jobs that have a letter.
  const tabs = TABS.filter((t) => t.key !== 'letter' || letterPath);
  const current: TabKey = tab === 'letter' && !letterPath ? 'description' : tab;
  const letter = current === 'letter' && letterPath ? await readLetter(letterPath) : null;

  return (
    <article className="panel">
      <header className="panel-head">
        <span className="avatar sea" aria-hidden="true">{job.company[0]?.toUpperCase()}</span>
        <p>
          <strong>{job.company}</strong>
          <span className="meta">{job.location}, posted {postedAgo(job.postedAt).toLowerCase()}</span>
        </p>
      </header>

      <h2 className="panel-title">{job.title}</h2>

      <div className="actions">
        <a className="btn primary" href={job.url} target="_blank" rel="noopener noreferrer">Apply ↗</a>
        {letterPath && <Link href={tabHref('letter')} scroll={false} className="done">✓ Letter written · Preview</Link>}
      </div>
      <RunStatus
        jobId={job.id}
        hasLetter={Boolean(letterPath)}
        hasMatch={Boolean(match)}
        run={run}
        triagePrompt={`Triage job ${job.id} with the job-triage agent, then run npm run rank -- --no-notify`}
      />

      <dl className="facts">
        <div><dt>Stage</dt><dd><StageSelect jobId={job.id} stage={app?.stage ?? 'new'} /></dd></div>
        <div><dt>Salary</dt><dd>{job.salary ?? '—'}</dd></div>
        <div><dt>Seniority</dt><dd>{job.seniority ?? '—'}</dd></div>
      </dl>

      {match ? (
        <section className="match-block" aria-label="Match">
          <p className="label">Match score</p>
          {match.rank !== null ? (
            <div className="score-row">
              <span className="score-big">{match.rank.toFixed(1)}</span>
              <span className="of">of 100</span>
              <span className={isStrong(match.verdict) ? 'pill sea' : 'pill'}>{isStrong(match.verdict) ? '✓ ' : ''}{match.verdict}</span>
            </div>
          ) : (
            <div className="score-row">
              <span className="pill">{match.verdict}</span>
              <span className="of">Not ranked</span>
            </div>
          )}
          {match.rank !== null && <ScoreBar score={match.rank} />}
          <p className="fit-line">Fit <b>{match.fit.toFixed(1)}</b> <span>Interest <b>{match.interest.toFixed(1)}</b></span></p>
          {match.reason && <blockquote>“{match.reason}”</blockquote>}
          {skills.length > 0 && (
            <>
              <p className="label">Lead with</p>
              <ul className="chips">{skills.map((s) => <li key={s} className="chip">{s}</li>)}</ul>
            </>
          )}
          {gaps.length > 0 && (
            <>
              <p className="label">Gaps</p>
              <ul className="gaps">
                {gaps.map((g) => {
                  const kind = gapKind(g.label);
                  return (
                    <li key={g.gap}>
                      <span>{g.gap}</span>
                      <span className={`pill ${kind === 'learnable' ? 'sea' : kind === 'reach' ? 'coral' : ''}`}>
                        {kind === 'learnable' ? 'Learnable' : kind === 'reach' ? 'Reach' : 'Minor'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : (
        <section className="match-block" aria-label="Match">
          <p className="label">Match score</p>
          <p className="muted">Not scored yet. Run /weekly to triage new jobs.</p>
        </section>
      )}

      <div className="tabs" role="tablist" aria-label="Job details">
        {tabs.map((t) => (
          <Link key={t.key} href={tabHref(t.key)} scroll={false} role="tab" aria-selected={current === t.key} className={current === t.key ? 'tab active' : 'tab'}>
            {t.label}
            {t.key === 'contacts' && contacts.length > 0 ? ` (${contacts.length})` : ''}
          </Link>
        ))}
      </div>

      {current === 'description' && <div className="prose">{job.description}</div>}

      {current === 'company' && (
        <div className="prose">
          {job.companyInfo ?? 'The scrape has no company information for this job.'}
          {job.benefits && <p className="benefits"><b>Benefits:</b> {job.benefits}</p>}
        </div>
      )}

      {letter && <LetterView result={letter} />}

      {current === 'contacts' && (
        <div>
          {contacts.length === 0 && <p className="muted">No contacts yet.</p>}
          <ul className="contact-list">
            {contacts.map((c) => (
              <li key={c.id}>
                <span className="avatar coral" aria-hidden="true">{c.name[0]?.toUpperCase()}</span>
                <div>
                  <strong>{c.name}</strong>
                  {c.role && <span className="meta"> · {c.role}</span>}
                  <div className="meta">
                    {c.email && <span>{c.email} </span>}
                    {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>}
                  </div>
                  {c.note && <div>{c.note}</div>}
                </div>
                <form action={deleteContact}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="contactId" value={c.id} />
                  <button type="submit" className="btn small">Remove</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addContact} className="form-grid">
            <input type="hidden" name="jobId" value={job.id} />
            <input name="name" placeholder="Name" aria-label="Name" required />
            <input name="role" placeholder="Role" aria-label="Role" />
            <input name="email" type="email" placeholder="Email" aria-label="Email" />
            <input name="linkedinUrl" type="url" placeholder="LinkedIn link" aria-label="LinkedIn link" />
            <input name="note" placeholder="Note, e.g. emailed on 16 Oct" aria-label="Note" />
            <button type="submit" className="btn">Add contact</button>
          </form>
        </div>
      )}

      {current === 'notes' && (
        <div>
          <form action={saveNotes} className="notes-form">
            <input type="hidden" name="jobId" value={job.id} />
            <textarea name="notes" rows={6} defaultValue={app?.notes ?? ''} placeholder="Anything worth remembering about this job" aria-label="Notes" />
            <button type="submit" className="btn">Save notes</button>
          </form>
          <form action={removeJob} className="remove-form">
            <p className="muted">Hides this job from your list. It stays in the database, so an import never brings it back.</p>
            <input type="hidden" name="jobId" value={job.id} />
            <button type="submit" className="btn small">Remove job</button>
          </form>
        </div>
      )}
    </article>
  );
}
