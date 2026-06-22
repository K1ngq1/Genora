import { db } from "@/lib/db";
import type { CanvasProjectData } from "@/lib/projects";
export { isSafeAssetPath } from "@/lib/storage";

export function assetUrl(id: string) {
  return `/api/assets/${encodeURIComponent(id)}`;
}

function isBlobUrl(value: unknown) {
  return typeof value === "string" && value.startsWith("blob:");
}

function canvasNode(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const node = value as Record<string, unknown>;
  const data = node.data && typeof node.data === "object" ? node.data as Record<string, unknown> : undefined;
  return { node, data };
}

export async function repairLegacyAssetUrls(canvasData: CanvasProjectData) {
  const candidates = canvasData.nodes
    .map(canvasNode)
    .map((entry) => ({
      taskId: typeof entry?.data?.taskId === "string" ? entry.data.taskId : undefined,
      originalName: typeof entry?.data?.startFrameName === "string" ? entry.data.startFrameName : undefined,
    }))
    .filter((item) => item.taskId || item.originalName);

  if (!candidates.length) return { canvasData, changed: false };

  const taskIds = [...new Set(candidates.flatMap((item) => item.taskId ? [item.taskId] : []))];
  const originalNames = [...new Set(candidates.flatMap((item) => item.originalName ? [item.originalName] : []))];
  const assets = await db.asset.findMany({
    where: {
      OR: [
        ...(taskIds.length ? [{ taskId: { in: taskIds } }] : []),
        ...(originalNames.length ? [{ originalName: { in: originalNames } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const byTask = new Map(assets.filter((asset) => asset.taskId).map((asset) => [asset.taskId as string, asset]));
  const byName = new Map<string, (typeof assets)[number]>();
  for (const asset of assets) {
    if (asset.originalName && !byName.has(asset.originalName)) byName.set(asset.originalName, asset);
  }

  let changed = false;
  const nodes = canvasData.nodes.map((value) => {
    const entry = canvasNode(value);
    if (!entry?.data) return value;
    const taskId = typeof entry.data.taskId === "string" ? entry.data.taskId : undefined;
    const originalName = typeof entry.data.startFrameName === "string" ? entry.data.startFrameName : undefined;
    const asset = (taskId ? byTask.get(taskId) : undefined) ?? (originalName ? byName.get(originalName) : undefined);
    if (!asset) return value;

    const data = { ...entry.data };
    let nodeChanged = false;
    for (const field of ["url", "startFrameUrl", "endFrameUrl"] as const) {
      if (isBlobUrl(data[field])) {
        data[field] = assetUrl(asset.id);
        changed = true;
        nodeChanged = true;
      }
    }
    return nodeChanged ? { ...entry.node, data } : value;
  });

  return { canvasData: changed ? { ...canvasData, nodes } : canvasData, changed };
}
