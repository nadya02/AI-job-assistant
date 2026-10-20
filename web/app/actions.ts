'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '../lib/prisma';
import { getCurrentUser } from '../lib/current-user';
import { STAGES } from '../lib/stages';
import { startRun } from '../lib/runner';
import { cleanUrl, contentHash, FORM_FIELDS, manualJobId, type AddJobState } from '../lib/add-job';

// Server actions for the tracker. They are reachable by a direct POST, not only
// through the forms, so each one checks its input and only touches rows that
// belong to the current user.

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optional(form: FormData, key: string): string | null {
  return text(form, key) || null;
}

// The person's row for this job, created the first time they act on it.
async function applicationFor(userId: number, jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) throw new Error('Job not found');
  return prisma.application.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: { userId, jobId },
    update: {},
  });
}

function refreshJob(jobId: string) {
  revalidatePath('/');
  revalidatePath('/new');
  revalidatePath(`/jobs/${jobId}`);
}

export async function setStage(form: FormData) {
  const user = await getCurrentUser();
  const jobId = text(form, 'jobId');
  const stage = text(form, 'stage');
  if (!STAGES.some((s) => s.key === stage)) throw new Error('Unknown stage');

  await applicationFor(user.id, jobId);
  await prisma.application.update({ where: { userId_jobId: { userId: user.id, jobId } }, data: { stage } });
  refreshJob(jobId);
}

export async function saveNotes(form: FormData) {
  const user = await getCurrentUser();
  const jobId = text(form, 'jobId');

  await applicationFor(user.id, jobId);
  await prisma.application.update({
    where: { userId_jobId: { userId: user.id, jobId } },
    data: { notes: optional(form, 'notes') },
  });
  refreshJob(jobId);
}

export async function addContact(form: FormData) {
  const user = await getCurrentUser();
  const jobId = text(form, 'jobId');
  const name = text(form, 'name');
  if (!name) throw new Error('A contact needs a name');

  // The link is rendered as an <a href>, so only web addresses are accepted.
  const linkedinUrl = optional(form, 'linkedinUrl');
  if (linkedinUrl && !/^https?:\/\//i.test(linkedinUrl)) throw new Error('The LinkedIn link must start with http:// or https://');

  const application = await applicationFor(user.id, jobId);
  await prisma.contact.create({
    data: {
      applicationId: application.id,
      name,
      role: optional(form, 'role'),
      email: optional(form, 'email'),
      linkedinUrl,
      note: optional(form, 'note'),
    },
  });
  refreshJob(jobId);
}

export async function deleteContact(form: FormData) {
  const user = await getCurrentUser();
  const jobId = text(form, 'jobId');
  const id = Number(text(form, 'contactId'));
  if (!Number.isInteger(id)) throw new Error('Bad contact id');

  // deleteMany with the owner in the filter: someone else's contact matches nothing.
  await prisma.contact.deleteMany({ where: { id, application: { userId: user.id } } });
  refreshJob(jobId);
}

// Soft delete: the Job row stays, so an import never brings it back. A job that
// has not been triaged yet is also marked skipped, so triage does not spend time on it.
export async function removeJob(form: FormData) {
  const user = await getCurrentUser();
  const jobId = text(form, 'jobId');

  await applicationFor(user.id, jobId);
  await prisma.application.update({ where: { userId_jobId: { userId: user.id, jobId } }, data: { removed: true } });
  await prisma.job.updateMany({
    where: { id: jobId, status: 'pending' },
    data: { status: 'skipped', skipReason: 'removed in the tracker' },
  });

  revalidatePath('/');
  revalidatePath('/new');
  redirect('/');
}

// Add a job by hand. If the same posting (company + description) is already in
// the database, nothing is duplicated: it is added to this person's list instead.
export async function addJob(_prev: AddJobState, form: FormData): Promise<AddJobState> {
  const user = await getCurrentUser();
  const values: Record<string, string> = {};
  for (const key of FORM_FIELDS) values[key] = text(form, key);
  // Browsers send textarea line breaks as \r\n; the scrape uses \n. Normalise so the content hash matches.
  values.description = values.description.replace(/\r\n?/g, '\n');
  const fail = (error: string): AddJobState => ({ error, values });

  if (!values.company) return fail('Add the company name.');
  if (!values.title) return fail('Add the job title.');
  if (!values.description) return fail('Paste the job description.');
  const url = cleanUrl(values.url);
  if (!url) return fail('The link must be a web address starting with http:// or https://.');
  if (!STAGES.some((s) => s.key === values.stage)) return fail('Pick a stage.');

  let postedAt = new Date();
  if (values.postedAt) {
    postedAt = new Date(values.postedAt);
    if (Number.isNaN(postedAt.getTime()) || postedAt.getTime() > Date.now() + 86_400_000) return fail('The posted date is not valid.');
  }

  const hash = contentHash(values.company, values.description);
  const existing = await prisma.job.findUnique({ where: { contentHash: hash }, select: { id: true } });

  let jobId = existing?.id ?? '';
  let notice = '';
  if (existing) {
    const mine = await prisma.application.findUnique({ where: { userId_jobId: { userId: user.id, jobId } } });
    notice = mine && !mine.removed ? 'listed' : mine ? 'restored' : 'existing';
    if (!mine) {
      await prisma.application.create({ data: { userId: user.id, jobId, stage: values.stage, notes: values.notes || null } });
    } else if (mine.removed) {
      await prisma.application.update({ where: { id: mine.id }, data: { removed: false } });
    }
  } else {
    jobId = manualJobId();
    await prisma.job.create({
      data: {
        id: jobId,
        title: values.title,
        company: values.company,
        location: values.location || 'Not specified',
        url,
        description: values.description,
        seniority: values.seniority || null,
        salary: values.salary || null,
        benefits: values.benefits || null,
        postedAt,
        contentHash: hash,
        mentionGerman: false,
        // Not triaged on save (docs/web-decisions.md). 'skipped' keeps the weekly
        // run from picking it up; a letter request triages it by id.
        status: 'skipped',
        skipReason: 'added manually; triaged when a letter is requested',
        source: 'manual',
        applications: { create: { userId: user.id, stage: values.stage, notes: values.notes || null } },
      },
    });
  }

  revalidatePath('/');
  revalidatePath('/new');
  redirect(`/?job=${encodeURIComponent(jobId)}${notice ? `&notice=${notice}` : ''}`);
}

// Start writing a cover letter for each job (M6). Runs headless Claude Code in the
// background; the pages show progress from the Run table.
export async function requestLetters(jobIds: string[]): Promise<{ started: number; errors: string[] }> {
  const user = await getCurrentUser();
  let started = 0;
  const errors: string[] = [];
  for (const id of jobIds.slice(0, 20)) {
    const r = await startRun(user.id, String(id), 'letter');
    if (r.ok) started++;
    else errors.push(r.error);
  }
  revalidatePath('/');
  revalidatePath('/new');
  return { started, errors };
}

export async function requestLetter(form: FormData) {
  await requestLetters([text(form, 'jobId')]);
}
