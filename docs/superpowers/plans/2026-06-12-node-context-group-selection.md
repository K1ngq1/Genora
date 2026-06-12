# Node Context Group Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context-menu clipboard operations, real container groups with fan-out connections, left-drag selection, and middle-button canvas panning.

**Architecture:** Extend the existing work-node model with a non-generating `group` kind using React Flow `parentId` relationships. Keep clipboard state in the canvas component and translate IDs, positions, parent relationships, and internal edges during paste.

**Tech Stack:** React 19, Next.js, TypeScript, React Flow 12, static Node regression checks.

---

### Task 1: Regression Contract

**Files:**
- Create: `scripts/check-node-context-group-selection.mjs`
- Modify: `package.json`

- [ ] Check right-click handlers and clipboard actions exist.
- [ ] Check group nodes use `parentId` and `extent: "parent"`.
- [ ] Check group connections fan out to members.
- [ ] Check React Flow uses `selectionOnDrag`, partial selection, and middle-button panning.
- [ ] Run the focused check and observe failure.

### Task 2: Clipboard and Context Menu

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/workflow.css`

- [ ] Add node-context-menu state and UI.
- [ ] Add internal clipboard snapshot for nodes and internal edges.
- [ ] Implement copy, cut, paste, and keyboard shortcuts.
- [ ] Reset transient generation state in pasted nodes.

### Task 3: Real Container Groups

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/workflow.css`

- [ ] Add `group` node kind and visual rendering.
- [ ] Group selected top-level nodes by converting positions to parent-relative coordinates.
- [ ] Ungroup by restoring absolute coordinates.
- [ ] Fan out group connections to each direct member.
- [ ] Preserve internal edges when copying a group.

### Task 4: Selection and Panning

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/workflow.css`

- [ ] Set `selectionOnDrag`.
- [ ] Set `selectionMode={SelectionMode.Partial}`.
- [ ] Set `panOnDrag={[1]}` for middle-button panning.
- [ ] Keep node dragging on the left button.

### Task 5: Verification

**Files:**
- Modify: `docs/prd.md`

- [ ] Record confirmed interactions.
- [ ] Run the focused check.
- [ ] Run `npm.cmd run check`.
- [ ] Verify context menu, grouping, paste, selection, and panning in the browser.
