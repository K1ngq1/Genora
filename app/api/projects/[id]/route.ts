import { db } from "@/lib/db";
import { repairLegacyAssetUrls } from "@/lib/assets";
import { normalizeProjectName, parseCanvasData, publicProject } from "@/lib/projects";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  const repaired = await repairLegacyAssetUrls(parseCanvasData(project.canvasData));
  const opened = await db.project.update({
    where: { id },
    data: {
      lastOpenedAt: new Date(),
      ...(repaired.changed ? { canvasData: JSON.stringify(repaired.canvasData) } : {}),
    },
  });
  return Response.json(publicProject(opened));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  const data: {
    name?: string;
    canvasData?: string;
    requiresRename?: boolean;
    lastOpenedAt: Date;
  } = { lastOpenedAt: new Date() };

  if ("name" in body) {
    const name = normalizeProjectName(body.name);
    if (!name) return Response.json({ error: "PROJECT_NAME_REQUIRED" }, { status: 400 });
    data.name = name;
    data.requiresRename = false;
  }
  if ("canvasData" in body) {
    data.canvasData = JSON.stringify(parseCanvasData(body.canvasData));
  }

  const project = await db.project.update({ where: { id }, data });
  return Response.json(publicProject(project));
}
