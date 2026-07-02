import { SIGNUP_OTP_CONFIG, getLatestOtp, incrementAttempts, markConsumed, sha256Hex } from "@/lib/signup-otp";
import { createAdminClient } from "@/lib/supabase/admin";

// Verifies the signup OTP and creates a fully email-confirmed Supabase user via
// the service role. No Supabase confirmation email is involved — the OTP we
// sent ourselves is the proof of email ownership. After this returns ok, the
// client calls signInWithPassword() to establish its own session.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();

    if (!email) return jsonResponse({ ok: false, error: "请输入邮箱" }, 400);
    if (password.length < 6) return jsonResponse({ ok: false, error: "密码至少需要 6 个字符" }, 400);
    if (!/^\d{6}$/.test(code)) return jsonResponse({ ok: false, error: "请输入 6 位验证码" }, 400);

    const record = await getLatestOtp(email);
    if (!record || record.consumedAt) {
      return jsonResponse({ ok: false, error: "验证码无效，请重新获取" }, 400);
    }
    if (Date.now() >= new Date(record.expiresAt).getTime()) {
      return jsonResponse({ ok: false, error: "验证码已过期，请重新获取" }, 400);
    }
    if (record.attempts >= SIGNUP_OTP_CONFIG.maxAttempts) {
      return jsonResponse({ ok: false, error: "验证码错误次数过多，请重新获取" }, 400);
    }

    if (sha256Hex(code) !== record.codeHash) {
      await incrementAttempts(record.id).catch((cause) => {
        console.error("[signup-verify] incrementAttempts error:", cause instanceof Error ? cause.message : cause);
      });
      return jsonResponse({ ok: false, error: "验证码错误，请检查后重新输入" }, 400);
    }

    // Code verified — consume it so it can't be replayed.
    await markConsumed(record.id);

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { name } : undefined,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("been registered")) {
        return jsonResponse({ ok: false, error: "该邮箱已注册，请直接登录" }, 409);
      }
      if (msg.includes("password")) {
        return jsonResponse({ ok: false, error: "密码强度不足，请使用至少 6 位的密码" }, 400);
      }
      console.error("[signup-verify] createUser error:", error.message);
      return jsonResponse({ ok: false, error: "注册失败，请稍后重试" }, 500);
    }

    console.log("[signup-verify] user created:", data.user?.email);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[signup-verify] error:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return jsonResponse({ ok: false, error: "注册失败，请稍后重试" }, 500);
  }
}
