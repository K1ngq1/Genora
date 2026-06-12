# Canvas Project Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist canvas projects in SQLite and provide keyboard save, autosave, durable uploads, and a standalone project library.

**Architecture:** Store project metadata and serialized React Flow state in Prisma. Use focused App Router APIs for project CRUD and uploads, then hydrate serializable node data with runtime callbacks in the canvas.

**Tech Stack:** Next.js App Router, React 19, React Flow, Prisma, SQLite, TypeScript.

---

### Task 1: Persistence Contract

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `scripts/init-db.mjs`
- Create: `lib/projects.ts`
- Test: `scripts/check-project-library.mjs`

- [ ] Add a failing static contract check.
- [ ] Add the Prisma `Project` model and SQLite initialization SQL.
- [ ] Add project serialization and validation helpers.
- [ ] Run the project-library check.

### Task 2: Project and Upload APIs

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/[id]/route.ts`
- Create: `app/api/uploads/route.ts`

- [ ] Add project list/create handlers.
- [ ] Add project load/save/rename handler.
- [ ] Add durable image/video upload handler.
- [ ] Run type checking.

### Task 3: Canvas Save and Restore

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/workflow.css`

- [ ] Load or create the active project.
- [ ] Serialize and hydrate canvas state.
- [ ] Add mandatory rename dialog.
- [ ] Add `Ctrl+S` and ten-minute autosave.
- [ ] Persist local uploads before node creation.
- [ ] Show project name and save status.

### Task 4: Standalone Project Library

**Files:**
- Create: `app/projects/page.tsx`
- Create: `app/projects/projects.css`

- [ ] Show project cards and timestamps.
- [ ] Add create, open, and rename interactions.
- [ ] Link the canvas header to `/projects`.

### Task 5: Verification

**Files:**
- Modify: `package.json`

- [ ] Add the project-library check to `npm run check`.
- [ ] Generate Prisma Client.
- [ ] Run all checks and production build.
- [ ] Verify save, refresh, and library restore in the browser.
