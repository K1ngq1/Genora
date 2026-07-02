import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Password-reset tokens. Reuses the `signup_otps` table with purpose='reset'.
// The token is a 32-byte random hex string; only its SHA-256 hash is stored.
// A reset link carries the plaintext token; the server re-hashes it to look up
// the row. Server-only.

const RESET_TTL_MINUTES = 10;

export const RESET_TOKEN_CONFIG = {
  ttlMinutes: RESET_TTL_MINUTES,
} as const;

export type ResetTokenRecord = {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

type DbRow = {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

function toRecord(row: DbRow): ResetTokenRecord {
  return {
    id: row.id,
    email: row.email,
    tokenHash: row.code_hash,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Issues a new reset token for an email and returns the plaintext token (to be
// embedded in the reset link). Old reset tokens for the same email are left in
// place but each carries its own hash, so only the latest link's hash matches.
export async function createResetToken(email: string): Promise<string> {
  const admin = createAdminClient();
  const token = generateResetToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();
  const { error } = await admin.from("signup_otps").insert({
    email,
    code_hash: tokenHash,
    purpose: "reset",
    attempts: 0,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return token;
}

// Finds an unconsumed reset token by re-hashing the presented plaintext token.
// Returns null if none matches (invalid / already used / different purpose).
export async function findValidResetToken(token: string): Promise<ResetTokenRecord | null> {
  const admin = createAdminClient();
  const tokenHash = hashToken(token);
  const { data, error } = await admin
    .from("signup_otps")
    .select("id, email, code_hash, expires_at, consumed_at, created_at")
    .eq("purpose", "reset")
    .eq("code_hash", tokenHash)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data as DbRow) : null;
}

export async function markResetConsumed(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("signup_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
