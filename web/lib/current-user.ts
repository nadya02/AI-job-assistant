import { prisma } from './prisma';

// There is no login yet, so every request acts as the first User row. Real
// accounts replace this one function later; the pages already ask for "the
// current user" and filter everything by their id.
export async function getCurrentUser() {
  const existing = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
  return existing ?? prisma.user.create({ data: { name: 'Me' } });
}
