export type AgnesVideoState = {
  remoteStatus: string;
  progress: number | null;
  queuedSeconds: number | null;
  queueWarning: boolean;
};

const QUEUE_WARNING_SECONDS = Number(process.env.AGNES_QUEUE_WARNING_SECONDS ?? 15 * 60);
const NON_TERMINAL = new Set(["queued", "processing", "in_progress", "running", "pending"]);

function numberValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function createdAtSeconds(value: unknown) {
  const created = numberValue(value);
  if (created === null || created <= 0) return null;
  return created > 10_000_000_000 ? Math.floor(created / 1000) : Math.floor(created);
}

export function describeAgnesVideoState(result: Record<string, unknown>, nowSeconds = Math.floor(Date.now() / 1000)): AgnesVideoState {
  const remoteStatus = String(result.status ?? result.state ?? "processing").toLowerCase();
  const progress = numberValue(result.progress);
  const createdAt = createdAtSeconds(result.created_at ?? result.createdAt);
  const queuedSeconds = NON_TERMINAL.has(remoteStatus) && createdAt ? Math.max(0, nowSeconds - createdAt) : null;

  return {
    remoteStatus,
    progress,
    queuedSeconds,
    queueWarning: Boolean(queuedSeconds !== null && queuedSeconds >= QUEUE_WARNING_SECONDS),
  };
}
