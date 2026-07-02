"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { isValidEmail } from "@/features/auth/auth-validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      setPending(false);
      if (!res.ok || !data.ok) {
        setError(data.error || "发送失败，请重试");
        return;
      }
      setSent(true);
    } catch {
      setPending(false);
      setError("网络异常，请稍后重试");
    }
  };

  if (sent) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-success">
            <span className="auth-success-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </span>
            <span>若该邮箱已注册，重置链接已发送至 {email.trim()}，请前往邮箱查收（链接 10 分钟内有效，可能进入垃圾邮件文件夹）。</span>
            <Link className="auth-demo-link" href="/login" style={{ marginTop: 6 }}>返回登录</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-header">
          <h1>Genora</h1>
          <p>重置你的登录密码</p>
        </div>

        <label className="auth-field">
          <span>邮箱</span>
          <input type="email" placeholder="your@email.com" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <button className="auth-submit" type="submit" disabled={pending}>
          {pending ? "发送中…" : "发送重置链接"}
        </button>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-footer">
          想起来了？<Link href="/login">返回登录</Link>
        </div>
      </form>
    </div>
  );
}
