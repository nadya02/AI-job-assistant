import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from './paths';

export type LetterResult =
  | { ok: true; path: string; letter: string; brief: string | null }
  | { ok: false; path: string; reason: string };

// Reads a letter (and its brief, if there is one) from the path stored on Match.
// The path comes from the database, so it is only trusted if it points at a .md
// file directly inside cover-letters/. Read-only: the site never writes letters.
export async function readLetter(letterPath: string): Promise<LetterResult> {
  const root = projectRoot();
  const dir = path.join(root, 'cover-letters');
  const full = path.resolve(root, letterPath);
  if (path.dirname(full) !== dir || !full.endsWith('.md')) {
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
