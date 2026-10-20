import type { Prisma } from '@prisma/client';

// Jobs are shared between people; stage, notes, contacts and removal belong to
// one person's Application row. A job with no Application row for that person
// means "new, not removed", so the import scripts never have to create rows.

// Jobs this person can see: every scraped job, plus manual jobs they added
// (a manual job has an Application row for whoever added it), minus the ones
// they removed.
export function visibleTo(userId: number): Prisma.JobWhereInput[] {
  return [
    { OR: [{ source: 'linkedin' }, { applications: { some: { userId } } }] },
    { NOT: { applications: { some: { userId, removed: true } } } },
  ];
}

// This person's stage filter. "new" also matches jobs with no row yet.
export function inStage(userId: number, stage: string): Prisma.JobWhereInput {
  return stage === 'new'
    ? { applications: { none: { userId, stage: { not: 'new' } } } }
    : { applications: { some: { userId, stage } } };
}
