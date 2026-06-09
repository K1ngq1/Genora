import { publicTask } from "@/lib/tasks";
import { syncProcessingVideoTasks } from "@/lib/video-task-sync";

export async function POST() {
  const results = await syncProcessingVideoTasks();
  return Response.json({
    synchronized: results.length,
    tasks: results.map((result) => ({
      ...publicTask(result.task),
      
      syncError: result.syncError ?? null,
    })),
  });
}
