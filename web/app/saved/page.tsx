import Link from 'next/link';
import { prisma } from '../../lib/prisma';
import { getCurrentUser } from '../../lib/current-user';
import { visibleTo } from '../../lib/applications';
import { getPanelJob } from '../../lib/panel-job';
import { latestLetterRuns } from '../../lib/runner';
import { toRunView } from '../../lib/run-view';
import { stageLabel } from '../../lib/stages';
import { isSkip, postedAgo } from '../../lib/format';
import { JobPanel, tabFrom } from '../components/job-panel';
import { MiniScore } from '../components/score-bar';
import { SaveJob } from '../components/save-job';

// Always read fresh data: the pipeline changes the database outside of this app.
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function SavedPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const rows = await prisma.job.findMany({
    where: { AND: [...visibleTo(user.id), { applications: { some: { userId: user.id, savedAt: { not: null } } } }] },
    include: { match: true, applications: { where: { userId: user.id } } },
    orderBy: [{ match: { rank: { sort: 'desc', nulls: 'last' } } }, { postedAt: { sort: 'desc', nulls: 'last' } }],
  });

  // The open job is the one in the URL. Unlike /, nothing is open by default:
  // with none selected the cards use the full width.
  const selectedId = first(params.job);
  const selected = selectedId ? await getPanelJob(user.id, selectedId) : null;
  const selectedRun = selected ? toRunView((await latestLetterRuns([selected.id])).get(selected.id)) : null;
  const tab = tabFrom(first(params.tab));
  const tabHref = (t: string) => `/saved?job=${encodeURIComponent(selectedId)}${t === 'description' ? '' : `&tab=${t}`}`;

  return (
    <main>
      <header className="page-head">
        <div>
          <h1>Saved jobs</h1>
          <p className="subtitle">{rows.length} {rows.length === 1 ? 'job' : 'jobs'} you plan to apply to</p>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="empty">
          Nothing saved yet. Click the bookmark icon on a job in <Link href="/">Jobs</Link> to add it here.
        </p>
      ) : (
        <div className={selected ? 'workspace' : undefined}>
          <ul className="saved-grid" aria-label="Saved jobs">
            {rows.map((job) => {
              const stage = job.applications[0]?.stage ?? 'new';
              const label = `${job.title} at ${job.company}`;
              const open = `/saved?job=${encodeURIComponent(job.id)}`;
              return (
                <li key={job.id} className={job.id === selected?.id ? 'saved-card selected' : 'saved-card'}>
                  <div className="saved-top">
                    <div className="saved-id">
                      <span className="jrow-company">{job.company}</span>
                      <Link href={open} scroll={false} className="saved-title">{job.title}</Link>
                    </div>
                    <div className="jrow-score">
                      {job.match?.rank != null ? (
                        <MiniScore score={job.match.rank} />
                      ) : (
                        <span className="not-scored">{job.match ? (isSkip(job.match.verdict) ? 'Skipped' : 'Not ranked') : 'Not scored yet'}</span>
                      )}
                    </div>
                  </div>
                  <p className="meta">{job.location} · posted {postedAgo(job.postedAt).toLowerCase()}</p>
                  <div className="jrow-meta">
                    <span className={`pill stage-${stage}`}>{stageLabel(stage)}</span>
                    <span>{job.match?.letterPath ? '✓ Letter written' : 'No letter yet'}</span>
                  </div>
                  <div className="saved-actions">
                    <a className="btn primary small" href={job.url} target="_blank" rel="noopener noreferrer">Apply ↗</a>
                    <Link href={open} scroll={false} className="btn small">Details</Link>
                    <SaveJob jobId={job.id} saved label={label} />
                  </div>
                </li>
              );
            })}
          </ul>
          {selected && <JobPanel job={selected} tab={tab} tabHref={tabHref} run={selectedRun} closeHref="/saved" />}
        </div>
      )}
    </main>
  );
}
