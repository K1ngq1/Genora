import { db } from "@/lib/db";
import { getUserId } from "@/lib/get-user-id";
import { publicTask, type TaskListResponse } from "@/lib/tasks";
import { ensureVisitorId } from "@/lib/visitor";

export async function GET(request: Request) {
  const headers = new Headers();
  ensureVisitorId(request, headers);
  const userId = await getUserId();
  const url = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page") ?? "1")) || 1);
  const requestedPageSize = Math.floor(Number(url.searchParams.get("pageSize") ?? "20")) || 20;
  const pageSize = Math.min(50, Math.max(1, requestedPageSize));
  // Fetch one extra to compute hasMore without a separate count query.
  const rows = await db.task.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });
  const hasMore = rows.length > pageSize;
  const payload: TaskListResponse = {
    items: rows.slice(0, pageSize).map(publicTask),
    page,
    pageSize,
    hasMore,
  };
  return Response.json(payload, { headers });
}
