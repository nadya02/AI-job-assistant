import path from 'node:path';

// The site runs from web/; the pipeline files (cover-letters/, scripts/, ...) live at the project root.
export function projectRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'web' ? path.dirname(cwd) : cwd;
}
