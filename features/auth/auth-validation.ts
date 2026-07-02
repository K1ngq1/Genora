// Shared auth validation + a localStorage-backed mock "account database".
// The project has no Supabase backend configured, so registration persists
// accounts locally: emails are de-duplicated and passwords are SHA-256 hashed.
// When Supabase is configured, auth-provider can swap these for real calls.

export type AuthAccount = {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
};

const ACCOUNTS_KEY = "genora.auth.accounts";
const PASSWORD_SALT = "genora::";

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; color: string };

const STRENGTH_LABELS = ["太弱", "弱", "中", "强", "很强"];
const STRENGTH_COLORS = ["#ff7b88", "#ff9b6f", "#ffd36f", "#9be37a", "#6bd1a0"];

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "太弱", color: STRENGTH_COLORS[0] };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  if (hasLower && hasUpper) score += 1;
  if (hasDigit && hasSymbol) score += 1;
  const finalScore = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: finalScore, label: STRENGTH_LABELS[finalScore], color: STRENGTH_COLORS[finalScore] };
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(PASSWORD_SALT + password);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function readAccounts(): AuthAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && typeof item.email === "string" && typeof item.passwordHash === "string" && typeof item.name === "string",
    ) as AuthAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: AuthAccount[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 50)));
}

export function findAccount(email: string): AuthAccount | undefined {
  const target = email.trim().toLowerCase();
  return readAccounts().find((account) => account.email.toLowerCase() === target);
}

export function addAccount(account: AuthAccount): boolean {
  const accounts = readAccounts();
  if (accounts.some((item) => item.email.toLowerCase() === account.email.toLowerCase())) return false;
  writeAccounts([account, ...accounts]);
  return true;
}

export function deriveName(email: string) {
  const local = email.split("@")[0]?.trim();
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "Genora 用户";
}
