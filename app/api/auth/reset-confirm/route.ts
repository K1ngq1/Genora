import { findValidResetToken, markResetConsumed } from "@/lib/reset-token";
import { createAdminClient } from "@/lib/supabase/admin";

// Verifies the reset token from the email link and updates the user's password
// via the service role. The token is single-use and consumed on success.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");

    if (!token) return jsonResponse({ ok: false, error: "重置链接无效，请重新申请" }, 400);
    if (password.length < 6) return jsonResponse({ ok: false, error: "密码至少需要 6 个字符" }, 400);

    const record = await findValidResetToken(token);
    if (!record) {
      return jsonResponse({ ok: false, error: "重置链接无效或已使用，请重新申请" }, 400);
    }
    if (Date.now() >= new Date(record.expiresAt).getTime()) {
      return jsonResponse({ ok: false, error: "重置链接已过期，请重新申请" }, 400);
    }

    // Resolve the user id by email, then update the password.
    const admin = createAdminClient();
    const { data: listData, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      console.error("[reset-confirm] listUsers error:", listError.message);
      return jsonResponse({ ok: false, error: "重置失败，请稍后重试" }, 500);
    }
    const target = (listData?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === record.email);
    if (!target) {
      return jsonResponse({ ok: false, error: "账号不存在，请重新申请" }, 404);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { password });
    if (updateError) {
      const msg = updateError.message.toLowerCase();
      if (msg.includes("password")) {
        return jsonResponse({ ok: false, error: "密码强度不足，请使用至少 6 位的密码" }, 400);
      }
      console.error("[reset-confirm] updateUserById error:", updateError.message);
      return jsonResponse({ ok: false, error: "重置失败，请稍后重试" }, 500);
    }

    await markResetConsumed(record.id);
    console.log("[reset-confirm] password updated for:", record.email);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[reset-confirm] error:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return jsonResponse({ ok: false, error: "重置失败，请稍后重试" }, 500);
  }
}
