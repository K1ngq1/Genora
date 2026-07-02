import nodemailer from "nodemailer";
import { SIGNUP_OTP_CONFIG, createOtp, getLatestOtp, isWithinCooldown } from "@/lib/signup-otp";

// Self-hosted signup OTP sender. Generates a 6-digit code, stores its hash in
// `signup_otps`, and emails the plaintext code via SMTP (QQ / 163 / Gmail /
// Tencent EXMail, etc.). The password never comes through this route — it is
// submitted in /signup-verify after the code is confirmed.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function renderOtpEmail(code: string, name: string): string {
  const greeting = name ? `<p>你好，${escapeHtml(name)}：</p>` : "<p>你好：</p>";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937;">
  ${greeting}
  <p>欢迎注册 Genora，你的注册验证码是：</p>
  <h1 style="letter-spacing:8px;font-size:34px;color:#10b981;margin:16px 0;text-align:center;">${code}</h1>
  <p style="color:#6b7280;font-size:13px;line-height:1.6;">验证码 ${SIGNUP_OTP_CONFIG.ttlMinutes} 分钟内有效，请回到注册页面输入完成注册。如非本人操作，请忽略本邮件。</p>
</div>`;
}

function getSmtpTransport(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }
  const port = Number(process.env.SMTP_PORT ?? "465");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ ok: false, error: "请输入有效的邮箱地址" }, 400);
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("[signup-send] missing SMTP config");
      return jsonResponse({ ok: false, error: "邮件服务未配置，暂时无法发送验证码" }, 503);
    }

    // Rate limit: one code per email per cooldown window.
    const latest = await getLatestOtp(email).catch((cause) => {
      console.error("[signup-send] getLatestOtp error:", cause instanceof Error ? cause.message : cause);
      return null;
    });
    if (isWithinCooldown(latest)) {
      return jsonResponse(
        { ok: false, error: `操作过于频繁，请 ${SIGNUP_OTP_CONFIG.resendCooldownSeconds} 秒后再试` },
        429,
      );
    }

    const { code } = await createOtp(email);

    const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER;
    const transport = getSmtpTransport();
    const info = await transport.sendMail({
      from,
      to: email,
      subject: `你的 Genora 注册验证码：${code}`,
      html: renderOtpEmail(code, name),
    });

    console.log("[signup-send] otp sent to:", email, "messageId:", info.messageId);
    return jsonResponse({ ok: true, awaitOtp: true });
  } catch (error) {
    console.error("[signup-send] error:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return jsonResponse({ ok: false, error: "发送验证码失败，请稍后重试" }, 500);
  }
}
