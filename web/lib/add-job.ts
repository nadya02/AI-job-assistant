import { createHash } from 'node:crypto';

// What the add-job form sends back to itself after a failed save, so nothing
// the person typed is lost.
export interface AddJobState {
  error?: string;
  values?: Record<string, string>;
}

export const FORM_FIELDS = [
  'company', 'title', 'location', 'url', 'description', 'salary', 'seniority',
  'benefits', 'postedAt', 'stage', 'notes',
] as const;

// Same recipe as computeContentHash in scripts/import-jobs.ts. Keep them equal:
// that is how a job added here is recognised when the same posting is imported
// later (and the other way round).
export function contentHash(company: string, description: string): string {
  return createHash('sha256')
    .update(company.toLowerCase() + '\n' + description)
    .digest('hex');
}

const TRACKING_PARAMS = ['refId', 'trackingId', 'position', 'pageNum', 'trk', 'trkInfo'];

// Web addresses only (the link is rendered as <a href>), minus tracking params
// like the import does. Returns null when it is not a usable address.
export function cleanUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.includes(key) || key.startsWith('utm_')) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

// Manual jobs get a numeric id because the pipeline scripts (mark-letter.ts,
// letters.ts) only accept digits. 17 digits starting with 9 cannot collide with
// LinkedIn ids, which have 10.
export function manualJobId(): string {
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `9${Date.now()}${random}`;
}
