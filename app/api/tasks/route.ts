import { db } from "@/lib/db";
import { publicTask } from "@/lib/tasks";

export async function GET() {
  const tasks = await db.task.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return Response.json(tasks.map(publicTask));
}
