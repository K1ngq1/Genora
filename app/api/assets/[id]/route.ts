import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSafeAssetPath } from "@/lib/assets";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/get-user-id";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  const { id } = await context.params;
  const asset = await db.asset.findUnique({ where: { id, userId } });
  if (!asset || !isSafeAssetPath(asset.path)) return new Response("Not found", { status: 404 });
  try {
    const file = await readFile(asset.path);
    const byteSize = asset.byteSize > 0 ? asset.byteSize : file.length;
    if (asset.byteSize !== byteSize) {
      void db.asset.update({ where: { id: asset.id }, data: { byteSize } }).catch(() => undefined);
    }
    return new Response(file, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(byteSize),
        "Content-Disposition": `inline; filename="${path.basename(asset.originalName ?? "asset").replace(/["\\]/g, "-")}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
