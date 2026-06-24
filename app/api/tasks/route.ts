import { db } from "@/lib/db";
import { getUserId } from "@/lib/get-user-id";
import { publicTask } from "@/lib/tasks";

export async function GET() {
  const userId = await getUserId();
  const tasks = await db.task.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json(tasks.map(publicTask));
}
