// Marks a job as 'letter_done' after its cover letter was written.
// Run with:  node scripts/mark-letter.ts <jobId>
// Does not send anything. Only updates the status in the Job table.

import { PrismaClient } from '@prisma/client';

const jobId = process.argv[2];
if (!jobId || !/^\d+$/.test(jobId)) {
  console.error('Usage: mark-letter.ts <jobId>');
  process.exit(1);
}

const prisma = new PrismaClient();

prisma.job
  .update({ where: { id: jobId }, data: { status: 'letter_done' } })
  .then(() => console.log(`${jobId}: status letter_done`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
