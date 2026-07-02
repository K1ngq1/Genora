import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/error-codes";

/**
 * 从请求的 Supabase session 中提取 userId。
 * 如果未登录，抛出 AppError(401)。
 */
export async function getUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("UNKNOWN_ERROR" as never, 401, "Authentication required");
  }

  return user.id;
}
