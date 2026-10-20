import { prisma } from '../../lib/prisma';
import { getCurrentUser } from '../../lib/current-user';
import { newJobsWhere } from '../../lib/new-jobs';
import { visibleTo } from '../../lib/applications';
import { initials } from '../../lib/format';
import { NavLinks } from './nav-links';

export async function Nav() {
  const user = await getCurrentUser();
  const newCount = await prisma.job.count({ where: newJobsWhere(user.id) });
  const savedCount = await prisma.job.count({
    where: { AND: [...visibleTo(user.id), { applications: { some: { userId: user.id, savedAt: { not: null } } } }] },
  });

  return (
    <aside className="rail">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✓</span>
        <span className="brand-name">Job Tracker</span>
      </div>
      <NavLinks newCount={newCount} savedCount={savedCount} />
      <div className="rail-user">
        <span className="avatar coral" aria-hidden="true">{initials(user.name)}</span>
        <span>
          <span className="rail-user-name">{user.name}</span>
          <span className="rail-user-role">Job seeker</span>
        </span>
      </div>
    </aside>
  );
}
