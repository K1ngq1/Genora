# Video Sync Timeout Terminal State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist over-limit video tasks as failed timeouts and prevent terminal tasks from being scanned again.

**Architecture:** Keep the existing Prisma schema. Store the human-readable timeout in `Task.error`, store `TIMEOUT` in the existing JSON `params`, preserve `params.lastRemoteStatus`, and expose the separate error code through `publicTask`.

**Tech Stack:** Next.js App Router, TypeScript, Prisma SQLite, Node assertion scripts.

---

### Task 1: Timeout Regression Check

**Files:**
- Create: `scripts/check-video-sync-timeout.mjs`
- Modify: `package.json`

- [ ] Assert timeout persistence uses `failed`, `Video task timeout`, `TIMEOUT`, and `canResume: false`.
- [ ] Assert the background query excludes timeout and all terminal statuses.
- [ ] Assert public API exposes `params.errorCode`.
- [ ] Assert the frontend renders timeout failures as `已超时`.
- [ ] Run `node scripts/check-video-sync-timeout.mjs` and confirm it fails before implementation.

### Task 2: Terminal Timeout Persistence

**Files:**
- Modify: `lib/video-task-sync.ts`
- Modify: `lib/tasks.ts`

- [ ] Replace the resumable timeout write with a terminal failed timeout write.
- [ ] Preserve the existing params, including `lastRemoteStatus`, while setting `errorCode: "TIMEOUT"`.
- [ ] Restrict scans to active statuses only.
- [ ] Return `params.errorCode` separately from the human-readable error.

### Task 3: Frontend Timeout Label

**Files:**
- Modify: `app/page.tsx`

- [ ] Add the `TIMEOUT` localized label.
- [ ] Display `已超时` for failed timeout tasks in polling and project reconciliation.

### Task 4: Verification

**Files:**
- Modify: `docs/prd.md`

- [ ] Record the confirmed terminal timeout behavior.
- [ ] Run the focused timeout regression check.
- [ ] Run `npm.cmd run check`.
