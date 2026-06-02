import { syncAgnesVideo } from "@/lib/agnes";
import { db } from "@/lib/db";
import { errorMessage, publicTask } from "@/lib/tasks";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let task = await db.task.findUnique({ where: { id } });
  if (!task) return Response.json({ error: "任务不存在" }, { status: 404 });
  if (task.status === "processing" && task.remoteTaskId && task.type !== "image") {
    try {
      const result = await syncAgnesVideo(task.remoteTaskId, task.id);
      task = await db.task.update({ where: { id }, data: result });
    } catch (error) {
      task = await db.task.update({ where: { id }, data: { status: "failed", error: errorMessage(error) } });
    }
  }
  return Response.json(publicTask(task));
}
