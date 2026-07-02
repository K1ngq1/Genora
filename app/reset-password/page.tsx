"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import { passwordStrength } from "@/features/auth/auth-validation";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      setPending(false);
      if (!res.ok || !data.ok) {
        setError(data.error || "重置失败，请重试");
        return;
      }
      setSuccess(true);
    } catch {
      setPending(false);
      setError("网络异常，请稍后重试");
    }
  };

  if (success) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-success">
            <span className="auth-success-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span>密码已重置，请用新密码登录。</span>
            <Link className="auth-demo-link" href="/login" style={{ marginTop: 6 }}>前往登录</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-error">重置链接缺失，请通过邮件中的「重置密码」按钮打开本页。</div>
          <Link className="auth-demo-link" href="/forgot-password" style={{ marginTop: 12 }}>重新申请重置链接</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-header">
          <h1>Genora</h1>
          <p>设置新的登录密码</p>
        </div>

        <label className="auth-field">
          <span>新密码</span>
          <div className="auth-input-row">
            <input type={showPassword ? "text" : "password"} placeholder="至少 6 个字符" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="auth-eye" type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a13.6 13.6 0 0 1-2.2 3.2M6.6 6.6A13.6 13.6 0 0 0 2 11s3.5 7 10 7a10.9 10.9 0 0 0 4.2-.8M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
              )}
            </button>
          </div>
          {password && (
            <div className="auth-strength" aria-hidden>
              <div className="auth-strength-track"><i style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }} /></div>
              <span style={{ color: strength.color }}>{strength.label}</span>
            </div>
          )}
        </label>

        <label className="auth-field">
          <span>确认新密码</span>
          <input type={showPassword ? "text" : "password"} placeholder="再次输入新密码" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </label>

        <button className="auth-submit" type="submit" disabled={pending}>
          {pending ? "重置中…" : "重置密码"}
        </button>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-footer">
          <Link href="/login">返回登录</Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Genora</h1>
            <p>加载中…</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
