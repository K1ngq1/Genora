import { readFile } from "node:fs/promises";
import path from "node:path";
import { mimeFromName } from "@/lib/storage";

const STORAGE = path.resolve(process.cwd(), "storage");

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const segments = (await context.params).path;
  const filePath = path.resolve(STORAGE, ...segments);
  if (!filePath.startsWith(`${STORAGE}${path.sep}`)) return new Response("Forbidden", { status: 403 });
  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Content-Type": mimeFromName(filePath),
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
