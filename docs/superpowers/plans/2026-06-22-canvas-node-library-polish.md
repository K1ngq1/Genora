# Canvas Node and Project Library Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten the model picker, remove Ideogram, make media nodes follow source aspect ratios, unify the black glass visual language, and allow saved projects to be deleted safely.

**Architecture:** Keep model capability data centralized in `lib/model-catalog.ts`. Put media sizing in a pure reusable helper and let `WorkflowNode` update React Flow geometry after image/video metadata loads. Project deletion removes the Prisma project record and cascaded database rows, while intentionally retaining local asset files to comply with the repository deletion policy.

**Tech Stack:** Next.js 15, React 19, TypeScript, React Flow, Prisma, source-level Node.js regression checks.

---

### Task 1: Regression checks

**Files:**
- Create: `scripts/check-canvas-library-polish.mjs`
- Modify: `package.json`

- [ ] Assert that Ideogram catalog/runtime references are gone, the picker is flat, adaptive sizing hooks are present, and project DELETE UI/API exist.
- [ ] Run `node scripts/check-canvas-library-polish.mjs` and confirm it fails on the missing behavior.

### Task 2: Flat catalog and adaptive media nodes

**Files:**
- Create: `lib/node-media-layout.ts`
- Modify: `lib/model-catalog.ts`
- Modify: `lib/image-task-runner.ts`
- Modify: `app/page.tsx`

- [ ] Remove Ideogram models and its runtime branch; Agnes remains the free image provider.
- [ ] Render one flat model list with no provider grouping or source badge.
- [ ] Calculate bounded node dimensions from image/video metadata and call `useUpdateNodeInternals` after dimensions change.
- [ ] Run the focused regression check until it passes.

### Task 3: Black glass visual system

**Files:**
- Modify: `app/workflow.css`

- [ ] Replace purple-gray node and picker surfaces with transparent black glass, neutral borders, blur, and restrained selected states.
- [ ] Make media use its intrinsic aspect ratio without fixed-height cropping.

### Task 4: Project deletion

**Files:**
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `app/projects/page.tsx`
- Modify: `app/projects/projects.css`

- [ ] Add `DELETE /api/projects/[id]` with a 404 response for unknown projects.
- [ ] Add a delete action, destructive confirmation modal, loading state, local project-key cleanup, and immediate list refresh.
- [ ] Do not delete local asset files in this change.

### Task 5: Configuration and documentation cleanup

**Files:**
- Modify: `.env.example`
- Modify: `lib/error-codes.ts`
- Modify: `docs/api/keys.md`
- Modify: `docs/prd.md`
- Delete: `lib/ideogram.ts`

- [ ] Remove inactive Ideogram keys, messages, documentation, and the single integration module.
- [ ] Update the PRD with the confirmed flat picker, adaptive nodes, black glass styling, and project deletion behavior.

### Task 6: Verification

- [ ] Run `node scripts/check-canvas-library-polish.mjs`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Verify the canvas and project library in the in-app browser at `localhost:3000`.
