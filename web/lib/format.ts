export function postedAgo(date: Date | null): string {
  if (!date) return '—';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
}

export function isStrong(verdict: string): boolean {
  return verdict.toLowerCase().includes('strong');
}

export function isSkip(verdict: string): boolean {
  return verdict.toLowerCase().includes('skip');
}

// topSkills and gaps are stored as JSON text by save-match.ts.
export function parseSkills(json: string | null): string[] {
  try {
    const list = JSON.parse(json ?? '[]');
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export interface Gap {
  gap: string;
  label: string;
}

export function parseGaps(json: string | null): Gap[] {
  try {
    const list = JSON.parse(json ?? '[]');
    if (!Array.isArray(list)) return [];
    return list.flatMap((g) => (g && typeof g.gap === 'string' ? [{ gap: g.gap, label: String(g.label ?? '') }] : []));
  } catch {
    return [];
  }
}

// The triage labels gaps as learnable, soft, hard or experience-years. The
// design has two kinds: learnable (sea) and reach (coral). Soft gaps are minor.
export function gapKind(label: string): 'learnable' | 'reach' | 'minor' {
  if (label === 'learnable') return 'learnable';
  if (label === 'soft') return 'minor';
  return 'reach';
}
