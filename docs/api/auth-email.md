# Auth Email Setup

This project uses a self-hosted email flow for account registration and password reset.

Registration no longer depends on Supabase's default confirmation link. Instead:

1. The user enters an email and password on `/register`.
2. `POST /api/auth/signup-send` generates a 6-digit OTP.
3. The OTP hash is stored in Supabase table `signup_otps`.
4. The plaintext OTP is sent through SMTP.
5. `POST /api/auth/signup-verify` verifies the OTP and creates a Supabase user with `email_confirm: true`.

Password reset uses the same table with `purpose = 'reset'`.

## Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Genora <your@qq.com>"
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Never expose it with a `NEXT_PUBLIC_` prefix.

For QQ Mail, `SMTP_PASS` must be the SMTP authorization code, not the account login password.

## Supabase SQL

Run this once in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.signup_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  purpose text not null default 'signup',
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint signup_otps_purpose_check check (purpose in ('signup', 'reset'))
);

create index if not exists signup_otps_email_purpose_created_idx
  on public.signup_otps (email, purpose, created_at desc);

create index if not exists signup_otps_code_hash_purpose_idx
  on public.signup_otps (code_hash, purpose);

alter table public.signup_otps enable row level security;
```

The application accesses this table only from trusted server routes through the Supabase service-role key.

## Why Supabase Confirmation Links Were Avoided

If Supabase confirmation emails are used directly, the email template must point to a valid callback route and the Supabase project must allow that redirect URL. Without those settings, users can receive a confirmation email but land on a broken or non-matching redirect after clicking it.

The OTP flow avoids that redirect dependency and keeps the whole registration UX inside the app.
