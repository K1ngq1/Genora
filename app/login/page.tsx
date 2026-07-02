"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { isValidEmail } from "@/features/auth/auth-validation";

const DEMO_EMAIL = "demo@genora.ai";
const DEMO_PASSWORD = "demo123";

export default function LoginPage() {
  const router = useRouter();
  const { login, isMockMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    setPending(true);
    setError("");
    const result = await login(trimmed, password);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "登录失败，请重试");
      return;
    }
    router.push("/");
  };

  const useDemo = async () => {
    if (pending) return;
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
    setPending(true);
    const result = await login(DEMO_EMAIL, DEMO_PASSWORD);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "演示账号登录失败");
      return;
    }
    router.push("/");
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-header">
          <h1>Genora</h1>
          <p>登录你的账号继续创作</p>
        </div>

        <label className="auth-field">
          <span>邮箱</span>
          <input type="email" placeholder="your@email.com" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="auth-field">
          <span>密码</span>
          <div className="auth-input-row">
            <input type={showPassword ? "text" : "password"} placeholder="输入密码" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="auth-eye" type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a13.6 13.6 0 0 1-2.2 3.2M6.6 6.6A13.6 13.6 0 0 0 2 11s3.5 7 10 7a10.9 10.9 0 0 0 4.2-.8M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
              )}
            </button>
          </div>
        </label>

        {!isMockMode && (
          <Link href="/forgot-password" className="auth-forgot">忘记密码？</Link>
        )}

        <button className="auth-submit" type="submit" disabled={pending}>
          {pending ? "登录中…" : "登 录"}
        </button>

        {error && <div className="auth-error">{error}</div>}

        {isMockMode && (
          <button type="button" className="auth-demo-link" onClick={useDemo}>使用演示账号登录</button>
        )}

        <div className="auth-footer">
          还没有账号？<Link href="/register">立即注册</Link>
        </div>
      </form>
    </div>
  );
}
