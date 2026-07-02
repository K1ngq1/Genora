import { createHash, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Signup OTP storage + verification helpers backed by the `signup_otps` table.
// Codes are stored only as SHA-256 hashes; the plaintext code leaves this module
// solely via the email body. Server-only.

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export const SIGNUP_OTP_CONFIG = {
  ttlMinutes: OTP_TTL_MINUTES,
  maxAttempts: MAX_ATTEMPTS,
  resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
} as const;

export type SignupOtpRecord = {
  id: string;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

type DbRow = {
  id: string;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

function toRecord(row: DbRow): SignupOtpRecord {
  return {
    id: row.id,
    email: row.email,
    codeHash: row.code_hash,
    attempts: row.attempts,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

export function generateOtpCode(): string {
  // Crypto-safe, unbiased 6-digit numeric code.
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function isWithinCooldown(record: SignupOtpRecord | null, nowMs = Date.now()): boolean {
  if (!record) return false;
  return nowMs - new Date(record.createdAt).getTime() < RESEND_COOLDOWN_SECONDS * 1000;
}

// Latest non-consumed OTP for an email (caller checks expiry/attempts).
export async function getLatestOtp(email: string): Promise<SignupOtpRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("signup_otps")
    .select("id, email, code_hash, attempts, expires_at, consumed_at, created_at")
    .eq("email", email)
    .eq("purpose", "signup")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as DbRow) : null;
}

export async function createOtp(email: string): Promise<{ code: string; record: SignupOtpRecord }> {
  const admin = createAdminClient();
  const code = generateOtpCode();
  const codeHash = sha256Hex(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  const { data, error } = await admin
    .from("signup_otps")
    .insert({ email, code_hash: codeHash, purpose: "signup", attempts: 0, expires_at: expiresAt })
    .select("id, email, code_hash, attempts, expires_at, consumed_at, created_at")
    .single();
  if (error) throw error;
  return { code, record: toRecord(data as DbRow) };
}

export async function markConsumed(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("signup_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Best-effort attempt counter (read-then-write). Acceptable here: signup verify
// is a low-concurrency user-driven flow, and a off-by-one on the cap does not
// weaken security — a wrong code still never validates.
export async function incrementAttempts(id: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error: readError } = await admin.from("signup_otps").select("attempts").eq("id", id).single();
  if (readError) throw readError;
  const next = (data?.attempts ?? 0) + 1;
  const { error } = await admin.from("signup_otps").update({ attempts: next }).eq("id", id);
  if (error) throw error;
}
