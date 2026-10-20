import { prisma } from './prisma';
import { visibleTo } from './applications';

// One job for the detail panel, with only this user's Application (and its
// contacts). Always goes through visibleTo: a job id alone never opens a job.
export function getPanelJob(userId: number, id: string) {
  return prisma.job.findFirst({
    where: { AND: [{ id }, ...visibleTo(userId)] },
    include: {
      match: true,
      applications: { where: { userId }, include: { contacts: { orderBy: { createdAt: 'asc' } } } },
    },
  });
}
