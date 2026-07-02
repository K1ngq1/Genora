import nodemailer from "nodemailer";
import { createResetToken } from "@/lib/reset-token";
import { createAdminClient } from "@/lib/supabase/admin";

// Password reset: generates a single-use token, emails a reset link via SMTP.
// Returns the same success response regardless of whether the email is
// registered, to avoid leaking which addresses have accounts.

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

function getSmtpTransport(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP not configured");
  const port = Number(process.env.SMTP_PORT ?? "465");
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function renderResetEmail(resetUrl: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937;">
  <p>你好：</p>
  <p>你申请了重置 Genora 账号的密码，请点击下面的链接设置新密码：</p>
  <p style="margin:20px 0;text-align:center;">
    <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;font-size:15px;">重置密码</a>
  </p>
  <p style="word-break:break-all;color:#6b7280;font-size:12px;">按钮打不开？直接访问：<br/>${escapeHtml(resetUrl)}</p>
  <p style="color:#6b7280;font-size:13px;line-height:1.6;">链接 10 分钟内有效。如非本人操作，请忽略本邮件，你的密码不会变更。</p>
</div>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ ok: false, error: "请输入有效的邮箱地址" }, 400);
    }
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("[reset-send] missing SMTP config");
      return jsonResponse({ ok: false, error: "邮件服务未配置，暂时无法发送" }, 503);
    }

    // Look up the user. Note: admin.listUsers is paginated (first page only);
    // fine for current scale. If not found, silently succeed without sending.
    const admin = createAdminClient();
    const { data: listData, error: listError } = await admin.auth.admin.listUsers();
    const exists = listError
      ? false
      : (listData?.users ?? []).some((u) => (u.email ?? "").toLowerCase() === email);

    if (exists) {
      const token = await createResetToken(email);
      const origin = new URL(request.url).origin;
      const resetUrl = `${origin}/reset-password?token=${token}`;
      const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER;
      const transport = getSmtpTransport();
      const info = await transport.sendMail({
        from,
        to: email,
        subject: "重置你的 Genora 密码",
        html: renderResetEmail(resetUrl),
      });
      console.log("[reset-send] reset link sent to:", email, "messageId:", info.messageId);
    } else {
      console.log("[reset-send] email not registered, silent success:", email);
    }

    // Same response either way to prevent email enumeration.
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[reset-send] error:", error instanceof Error ? `${error.name}: ${error.message}` : error);
    return jsonResponse({ ok: false, error: "发送重置邮件失败，请稍后重试" }, 500);
  }
}
