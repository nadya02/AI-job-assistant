import { prisma } from '../../lib/prisma';
import { getCurrentUser } from '../../lib/current-user';
import { newJobsWhere } from '../../lib/new-jobs';
import { getPanelJob } from '../../lib/panel-job';
import { latestLetterRuns } from '../../lib/runner';
import { toRunView } from '../../lib/run-view';
import { JobPanel, tabFrom } from '../components/job-panel';
import { PickJobs, type NewJob } from './pick-jobs';

// Always read fresh data: the import and triage scripts change the database
// outside of this app.
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function NewJobsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const rows = await prisma.job.findMany({
    where: newJobsWhere(user.id),
    include: { match: true },
    orderBy: { match: { rank: { sort: 'desc', nulls: 'last' } } },
  });

  const jobs: NewJob[] = rows.flatMap((j) =>
    j.match
      ? [{ id: j.id, company: j.company, title: j.title, location: j.location, postedAt: j.postedAt?.toISOString() ?? null, rank: j.match.rank }]
      : [],
  );

  const runs = await latestLetterRuns(jobs.map((j) => j.id));
  const selectedId = first(params.job) || jobs[0]?.id || '';
  const selected = selectedId ? await getPanelJob(user.id, selectedId) : null;
  const tab = tabFrom(first(params.tab));
  const tabHref = (t: string) => `/new?job=${encodeURIComponent(selectedId)}${t === 'description' ? '' : `&tab=${t}`}`;

  return (
    <main>
      <header className="page-head">
        <div>
          <h1>{jobs.length} new {jobs.length === 1 ? 'job matches' : 'jobs match'} your profile</h1>
          <p className="subtitle">Select the jobs you want a cover letter for.</p>
        </div>
      </header>

      {jobs.length === 0 ? (
        <p className="empty">No new triaged jobs this week. Run /weekly to import and triage.</p>
      ) : (
        <PickJobs jobs={jobs} selectedId={selectedId} runStatus={Object.fromEntries([...runs].map(([id, r]) => [id, r.status]))}>
          {selected && <JobPanel job={selected} tab={tab} tabHref={tabHref} run={toRunView(runs.get(selected.id))} />}
        </PickJobs>
      )}
    </main>
  );
}
