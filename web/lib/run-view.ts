import type { RunInfo } from './runner';
import type { RunView } from '../app/components/run-status';

export function toRunView(info: RunInfo | undefined): RunView | null {
  return info
    ? { status: info.status, startedAt: info.startedAt?.toISOString() ?? null, summary: info.summary, error: info.error }
    : null;
}
