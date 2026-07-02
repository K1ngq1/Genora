"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth, type AuthIntent } from "@/features/auth/auth-provider";
import { isValidEmail, passwordStrength } from "@/features/auth/auth-validation";

const INTENT_COPY: Record<AuthIntent, { title: string; subtitle: string; banner?: string }> = {
  login: { title: "Genora", subtitle: "登录你的账号继续创作" },
  submit: { title: "Genora", subtitle: "登录后即可提交生成任务", banner: "提交任务前需要先登录账号。" },
  workspace: { title: "Genora", subtitle: "登录后进入工作空间", banner: "打开工作空间需要先登录账号。" },
  canvas: { title: "Genora", subtitle: "登录后打开无限画布", banner: "打开无限画布需要先登录账号。" },
  account: { title: "Genora", subtitle: "登录后同步创作记录", banner: "登录后即可同步你的创作记录与额度。" },
};

const DEMO_EMAIL = "demo@genora.ai";
const DEMO_PASSWORD = "demo123";
const RESEND_COOLDOWN = 60;

const EyeIcon = ({ open }: { open: boolean }) => (
  open ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a13.6 13.6 0 0 1-2.2 3.2M6.6 6.6A13.6 13.6 0 0 0 2 11s3.5 7 10 7a10.9 10.9 0 0 0 4.2-.8M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
  )
);

export function AuthDialog() {
  const { dialogOpen, intent, closeAuthDialog, login, register, verifySignupOtp, resendSignupOtp, isMockMode } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const strength = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuthDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, closeAuthDialog]);

  useEffect(() => {
    if (!dialogOpen) {
      setError("");
      setEmail("");
      setName("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setAgreed(false);
      setPending(false);
      setSuccess("");
      setConfirmation(false);
      setOtp("");
      setCooldown(0);
      return;
    }
    setMode("login");
  }, [dialogOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (!dialogOpen) return null;

  const copy = INTENT_COPY[intent] ?? INTENT_COPY.login;
  const isLogin = mode === "login";

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    setSuccess("");
  };

  const finishOnSuccess = (message: string) => {
    setSuccess(message);
    setPending(false);
    window.setTimeout(() => closeAuthDialog(), 1100);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (!password) {
      setError(isLogin ? "请输入密码" : "密码至少 6 个字符");
      return;
    }
    if (!isLogin) {
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
    }
    setPending(true);
    setError("");
    const result = isLogin
      ? await login(trimmedEmail, password)
      : await register(trimmedEmail, password, name);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "操作失败，请重试");
      return;
    }
    if (result.awaitOtp) {
      setConfirmation(true);
      setOtp("");
      setCooldown(RESEND_COOLDOWN);
      setPending(false);
      return;
    }
    finishOnSuccess(isLogin ? "登录成功，正在进入…" : `欢迎加入 Genora，${name.trim() || trimmedEmail}！`);
  };

  const useDemo = async () => {
    if (pending) return;
    setMode("login");
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
    setSuccess("");
    setPending(true);
    const result = await login(DEMO_EMAIL, DEMO_PASSWORD);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "演示账号登录失败");
      return;
    }
    finishOnSuccess("登录成功，正在进入…");
  };

  const verifyCode = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    const result = await verifySignupOtp(email.trim(), password, name, otp);
    if (!result.ok) {
      setPending(false);
      setError(result.error ?? "验证失败，请重试");
      return;
    }
    finishOnSuccess(`欢迎加入 Genora，${name.trim() || email.trim()}！`);
  };

  const resendCode = async () => {
    if (cooldown > 0 || pending) return;
    setError("");
    const result = await resendSignupOtp(email.trim());
    if (!result.ok) {
      setError(result.error ?? "重新发送失败，请稍后再试");
      return;
    }
    setCooldown(RESEND_COOLDOWN);
  };

  return (
    <div className="auth-dialog-backdrop" onClick={closeAuthDialog} role="presentation">
      <div className="auth-dialog-wrap" role="dialog" aria-modal="true" aria-label={isLogin ? "登录" : "注册"} onClick={(event) => event.stopPropagation()}>
        <button className="auth-dialog-close" type="button" aria-label="关闭" onClick={closeAuthDialog}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <header className="auth-header">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </header>

        {copy.banner && !success && !confirmation && (
          <p className="auth-intent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            <span>{copy.banner}</span>
          </p>
        )}

        {confirmation ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              verifyCode();
            }}
          >
            <p className="auth-otp-hint">验证码已发送至 <strong>{email.trim()}</strong></p>
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
            <button type="button" className="auth-demo-link" disabled={cooldown > 0} onClick={resendCode}>
              {cooldown > 0 ? `${cooldown}s 后可重新发送` : "重新发送验证码"}
            </button>
          </form>
        ) : success ? (
          <div className="auth-success">
            <span className="auth-success-icon">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span>{success}</span>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit}>
              {!isLogin && (
                <label className="auth-field">
                  <span>昵称（选填）</span>
                  <input type="text" placeholder="如何称呼你" maxLength={20} value={name} onChange={(event) => setName(event.target.value)} />
                </label>
              )}
              <label className="auth-field">
                <span>邮箱</span>
                <input type="email" placeholder="your@email.com" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="auth-field">
                <span>密码</span>
                <div className="auth-input-row">
                  <input type={showPassword ? "text" : "password"} placeholder={isLogin ? "输入密码" : "至少 6 个字符"} required minLength={isLogin ? 1 : 6} value={password} onChange={(event) => setPassword(event.target.value)} />
                  <button className="auth-eye" type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((current) => !current)}><EyeIcon open={showPassword} /></button>
                </div>
                {!isLogin && password && (
                  <div className="auth-strength" aria-hidden>
                    <div className="auth-strength-track"><i style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }} /></div>
                    <span style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </label>
              {isLogin && !isMockMode && (
                <Link href="/forgot-password" className="auth-forgot" onClick={closeAuthDialog}>忘记密码？</Link>
              )}
              {!isLogin && (
                <>
                  <label className="auth-field">
                    <span>确认密码</span>
                    <input type={showPassword ? "text" : "password"} placeholder="再次输入密码" required minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </label>
                  <label className="auth-agree">
                    <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                    <span>我已阅读并同意<a href="/terms" target="_blank" rel="noopener noreferrer">《用户协议》</a>与<a href="/privacy" target="_blank" rel="noopener noreferrer">《隐私政策》</a></span>
                  </label>
                </>
              )}
              <button className="auth-submit" type="submit" disabled={pending || (!isLogin && !agreed)}>
                {pending ? (isLogin ? "登录中…" : "注册中…") : isLogin ? "登 录" : "注 册"}
              </button>
              {error && <div className="auth-error">{error}</div>}
            </form>

            {isLogin && isMockMode && (
              <button type="button" className="auth-demo-link" onClick={useDemo}>使用演示账号登录</button>
            )}

            <div className="auth-footer">
              {isLogin ? (
                <>还没有账号？<button type="button" onClick={() => switchMode("register")}>立即注册</button></>
              ) : (
                <>已有账号？<button type="button" onClick={() => switchMode("login")}>立即登录</button></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
