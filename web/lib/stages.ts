export const STAGES = [
  { key: 'new', label: 'New' },
  { key: 'applied', label: 'Applied' },
  { key: 'messaged', label: 'Messaged' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
] as const;

export function stageLabel(key: string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}
