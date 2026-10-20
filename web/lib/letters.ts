import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from './paths';

export type LetterResult =
  | { ok: true; path: string; letter: string; brief: string | null }
  | { ok: false; path: string; reason: string };

// The path comes from the database, so it is only trusted if it points at a
// -cover-letter.md file directly inside cover-letters/. Null if it does not.
function letterFile(letterPath: string): string | null {
  const root = projectRoot();
  const full = path.resolve(root, letterPath);
  if (path.dirname(full) !== path.join(root, 'cover-letters') || !full.endsWith('-cover-letter.md')) return null;
  return full;
}

export const MAX_LETTER_CHARS = 20_000;

// The only place the site writes into cover-letters/ (see CLAUDE.md): replaces the
// text of a letter that already exists. Never creates or deletes files.
export async function writeLetter(letterPath: string, text: string): Promise<void> {
  const full = letterFile(letterPath);
  if (!full) throw new Error('The stored path is not a letter file in cover-letters/.');
  await access(full); // the letter must already exist
  const body = text.replace(/\r\n?/g, '\n').trim();
  if (!body) throw new Error('The letter cannot be empty.');
  if (body.length > MAX_LETTER_CHARS) throw new Error('The letter is too long.');
  const tmp = `${full}.tmp`;
  await writeFile(tmp, `${body}\n`, 'utf8');
  await rename(tmp, full);
}

// Reads a letter (and its brief, if there is one) from the path stored on Match.
export async function readLetter(letterPath: string): Promise<LetterResult> {
  const full = letterFile(letterPath);
  if (!full) {
    return { ok: false, path: letterPath, reason: 'The stored path is not a letter file in cover-letters/.' };
  }

  let letter: string;
  try {
    letter = await readFile(full, 'utf8');
  } catch {
    return { ok: false, path: letterPath, reason: 'The letter file was not found. It may have been moved or deleted.' };
  }

  let brief: string | null = null;
  try {
    brief = await readFile(full.replace(/-cover-letter\.md$/, '-brief.md'), 'utf8');
  } catch {
    // Older letters may have no brief.
  }
  return { ok: true, path: letterPath, letter, brief };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
