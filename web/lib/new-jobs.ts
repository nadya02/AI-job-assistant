import type { Prisma } from '@prisma/client';
import { inStage, visibleTo } from './applications';

export const NEW_WINDOW_DAYS = 7;

// New = triaged in the last week, not a Skip, no letter yet, and nothing done with it.
export function newJobsWhere(userId: number): Prisma.JobWhereInput {
  const since = new Date(Date.now() - NEW_WINDOW_DAYS * 86_400_000);
  return {
    AND: [...visibleTo(userId), inStage(userId, 'new')],
    createdAt: { gte: since },
    match: { is: { letterPath: null, NOT: { verdict: { contains: 'skip', mode: 'insensitive' } } } },
  };
}
