"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { isValidEmail, passwordStrength } from "@/features/auth/auth-validation";

const RESEND_COOLDOWN = 60;

export default function RegisterPage() {
  const router = useRouter();
  const { register, verifySignupOtp, resendSignupOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!agreed) {
      setError("请先同意用户协议与隐私政策");
      return;
    }
    setPending(true);
    setError("");
    const result = await register(trimmed, password, name);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "注册失败，请重试");
      return;
    }
    if (result.awaitOtp) {
      setStep("otp");
      setCooldown(RESEND_COOLDOWN);
      setPending(false);
      return;
    }
    router.push("/");
  };

  const verify = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    const result = await verifySignupOtp(email.trim(), password, name, otp);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "验证失败，请重试");
      return;
    }
    router.push("/");
  };

  const resend = async () => {
    if (cooldown > 0 || pending) return;
    setError("");
    const result = await resendSignupOtp(email.trim());
    if (!result.ok) {
      setError(result.error ?? "重新发送失败，请稍后再试");
      return;
    }
    setCooldown(RESEND_COOLDOWN);
  };

  if (step === "otp") {
    return (
      <div className="auth-shell">
        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault();
            verify();
          }}
        >
          <div className="auth-header">
            <h1>Genora</h1>
            <p>验证码已发送至 {email.trim()}</p>
          </div>

          <label className="auth-field">
            <span>验证码</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="输入 6 位验证码"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>

          <button className="auth-submit" type="submit" disabled={pending || otp.length !== 6}>
            {pending ? "验证中…" : "完成注册"}
          </button>

          {error && <div className="auth-error">{error}</div>}

          <button type="button" className="auth-demo-link" disabled={cooldown > 0} onClick={resend}>
            {cooldown > 0 ? `${cooldown}s 后可重新发送` : "重新发送验证码"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-header">
          <h1>Genora</h1>
          <p>创建账号，开始 AI 创作之旅</p>
        </div>

        <label className="auth-field">
          <span>昵称（选填）</span>
          <input type="text" placeholder="如何称呼你" maxLength={20} value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="auth-field">
          <span>邮箱</span>
          <input type="email" placeholder="your@email.com" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="auth-field">
          <span>密码</span>
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
          <span>确认密码</span>
          <input type={showPassword ? "text" : "password"} placeholder="再次输入密码" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </label>

        <label className="auth-agree">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          <span>我已阅读并同意<a href="/terms" target="_blank" rel="noopener noreferrer">《用户协议》</a>与<a href="/privacy" target="_blank" rel="noopener noreferrer">《隐私政策》</a></span>
        </label>

        <button className="auth-submit" type="submit" disabled={pending || !agreed}>
          {pending ? "注册中…" : "注 册"}
        </button>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-footer">
          已有账号？<Link href="/login">立即登录</Link>
        </div>
      </form>
    </div>
  );
}
