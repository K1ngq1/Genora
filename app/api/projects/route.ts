import { db } from "@/lib/db";
import { EMPTY_CANVAS_DATA, normalizeProjectName, publicProject } from "@/lib/projects";

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: [{ lastOpenedAt: "desc" }, { updatedAt: "desc" }],
  });
  return Response.json(projects.map(publicProject));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const name = normalizeProjectName(body.name);
  const project = await db.project.create({
    data: {
      name: name ?? "empty space",
      canvasData: JSON.stringify(EMPTY_CANVAS_DATA),
      requiresRename: !name,
    },
  });
  return Response.json(publicProject(project), { status: 201 });
}
