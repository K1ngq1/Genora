# AGENTS.md

Project instructions for Codex.

This file is intentionally written mostly in English to reduce encoding issues on Windows and across AI coding tools.

---

## 1. Priority Order

When instructions conflict, follow this order:

1. The user's latest explicit instruction
2. This project-level `AGENTS.md`
3. More specific instructions in subdirectories
4. Existing code conventions
5. Default Codex behavior

The user's current request always wins.

---

## 2. Project Goal

This project focuses on an image/video generation canvas.

Primary goals:

- Keep the canvas stable and responsive.
- Preserve existing UI flows unless the user asks to change them.
- Support image and video generation through providers such as Agnes, APIMart, or other external APIs.
- Preserve user-selected parameters such as prompt, negative prompt, image input, aspect ratio, resolution, and quality.
- Make task status traceable, recoverable, and easy to debug.
- Avoid code bloat.
- Avoid Chinese text corruption or encoding issues.
- Keep Git, local scripts, and deployment workflow simple.

---

## 3. General Working Rules

Always follow these rules:

- Make the smallest change that solves the user's request.
- Do not rewrite large parts of the project unless the user explicitly asks for a refactor.
- Do not change unrelated files.
- Do not change visible UI text unless requested.
- Do not change API contracts unless requested.
- Do not remove existing features.
- Do not remove task polling logic unless requested.
- Do not delete user data, generated files, task records, or config files unless requested.
- Read the relevant files before editing.
- Check the diff before finishing.
- Prefer simple and maintainable code over clever abstractions.
- Do not add large dependencies without explaining why they are necessary.

---

## 4. Task Size Rules

### 4.1 Small Tasks

For small tasks, edit directly.

Small tasks include:

- Fixing typos
- Fixing encoding issues
- Adjusting UI spacing, colors, sizes, shadows, or layout details
- Updating README or project docs
- Adding or editing npm scripts
- Fixing a localized bug
- Editing one file or a small group of closely related files
- Making a visual-only change
- Adding a simple CMD script

Small task workflow:

1. Inspect relevant files.
2. Apply the minimal change.
3. Review the diff.
4. Run available checks when reasonable.
5. Summarize what changed.

Do not create a long design document for small tasks.

---

### 4.2 Medium or Large Tasks

Create a short plan before editing if the task:

- Changes 3 or more files
- Touches both frontend and backend
- Changes API request or response fields
- Changes task polling, task status, or generation workflow
- Changes Supabase, storage, database, auth, or payment logic
- Adds a new provider or model integration
- Refactors shared architecture
- Changes global state management
- Adds a new major feature

Plan format:

```md
## Plan

### Goal
Explain the target result.

### Files
List files likely to change.

### Approach
Give 3-6 concise implementation steps.

### Risks
Mention possible risks to UI, API, task status, storage, or data.

### Verification
List commands or manual checks.
```

If the user says "directly implement" or "直接改", keep the plan very short and proceed.

---

### 4.3 Refactor Tasks

For refactor tasks, work in small rounds.

Each round must:

1. Be the smallest meaningful refactor.
2. State the files that will be touched before editing.
3. Preserve existing UI text, UI behavior, API contracts, task polling, and provider adapters unless the user explicitly asks otherwise.
4. Run verification after the change:
   - `npm.cmd run build`
   - relevant project check scripts
   - page/API smoke checks when routing, config, or data loading may be affected
5. If verification passes, create a commit.
6. Do not push unless the user explicitly asks to push.
7. If verification fails, report the failure first and do not broaden the refactor scope.

Do not combine multiple refactor goals in one round unless the user explicitly asks.

---

## 5. Encoding Rules

This project may contain Chinese text, but source files must remain safe for Windows and Git.

Rules:

- Always read and write text files as UTF-8.
- Do not convert files to GBK, ANSI, or other encodings.
- Do not replace valid Chinese text with corrupted characters.
- Do not rewrite Chinese text unless the user asks.
- Do not change file encoding just because the terminal displays garbled text.
- Prefer English in code comments, scripts, and config files.
- Avoid Chinese characters in script filenames.
- Avoid spaces and special characters in script filenames.
- Use ASCII-safe file names when creating new scripts or config files.

For Windows CMD, use this only when needed:

```cmd
chcp 65001
```

Do not use encoding changes as a substitute for fixing the real source file problem.

---

## 6. Windows and CMD Rules

The user's environment is Windows. PowerShell may be restricted.

Prefer CMD commands:

```cmd
npm install
npm run dev
npm run build
npm run lint
npm test
git status
git add path\to\file1 path\to\file2
git commit -m "fix: preserve queued task polling"
git push
```

Avoid PowerShell-only commands unless the user asks for PowerShell.

When creating scripts, prefer:

```txt
scripts/dev.cmd
scripts/build.cmd
scripts/git-push.cmd
scripts/check.cmd
```

CMD script example:

```cmd
@echo off
chcp 65001
npm run dev
pause
```

Do not use `Set-ExecutionPolicy` unless explicitly requested.

---

## 7. Frontend Rules

For frontend and canvas changes:

- Do not change visible UI copy unless requested.
- Do not remove buttons, menus, panels, nodes, or inputs unless requested.
- Do not break canvas drag, zoom, resize, node connection, or preview behavior.
- Do not change API calls when the request is visual-only.
- Do not move provider logic into React components.
- Keep visual changes localized.
- Prefer editing existing components and styles instead of creating many new files.
- Preserve responsive behavior.
- Keep generated image/video previews stable.
- Do not add animation libraries unless necessary and requested.

If the user asks for Apple style, liquid glass, gradient, or premium e-commerce style:

- Change visual styles only.
- Do not change business logic.
- Do not change generation workflow.
- Do not rename existing fields.
- Do not change user-visible text unless requested.

---

## 8. Backend and API Rules

For backend changes:

- Never hardcode API keys.
- Never expose server-only keys to the frontend.
- Never commit `.env`.
- Update `.env.example` when adding new environment variables.
- Keep provider adapters isolated when possible.
- Preserve raw provider error information, but redact secrets.
- Log provider task id, status, and error body when available.
- Do not swallow upstream errors.
- Do not treat `queued` as failure.
- Do not treat local timeout as upstream failure.
- Preserve request fields such as prompt, negativePrompt, image, ratio, resolution, aspectRatio, and quality.
- Maintain backward compatibility for existing request fields when possible.

Recommended provider structure if the project has no better convention:

```txt
services/
  providers/
config/
features/
lib/
```

If the project already has a structure, follow the existing structure.

---

## 9. Image and Video Task Rules

Generation tasks may follow this flow:

1. Frontend submits prompt, image, aspect ratio, quality, and model options.
2. Backend creates a local task.
3. Backend calls the upstream provider.
4. Provider returns a result or provider task id.
5. Backend polls provider status when needed.
6. Backend stores final output URL or local file path.
7. Frontend displays the result.

Task statuses must stay clear.

Common statuses:

```txt
pending
queued
processing
running
completed
failed
timeout
cancelled
```

Rules:

- `queued` means waiting, not failed.
- `processing` means running, not failed.
- `running` means running, not failed.
- Local timeout means local polling limit was reached; it does not prove the upstream task failed.
- Preserve provider task id after timeout if future status checks are possible.
- Store useful error messages when a task fails.
- Store output URL or file path when a task succeeds.
- Do not clear old task records unless requested.
- Do not delete generated results unless requested.
- Make task state recoverable when possible.

---

## 10. Supabase and Storage Rules

If Supabase is used:

- Frontend may use anon key only.
- Service role key must stay server-side only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Do not commit real Supabase keys.
- Use stable storage paths.
- Check whether a bucket exists before creating it.
- Do not recreate buckets on every app start.
- If uploading local images for provider access, ensure the provider can access a public or signed URL.
- Signed URLs must live long enough for the generation task.
- Upload failure must return a clear error.

Recommended task fields:

```txt
taskId
provider
providerTaskId
model
prompt
negativePrompt
inputImageUrl
outputUrl
status
errorMessage
createdAt
updatedAt
```

---

## 11. Aspect Ratio, Resolution, and Quality Rules

Do not drop user-selected generation parameters.

Important fields:

```txt
aspectRatio
ratio
resolution
quality
width
height
```

Rules:

- Preserve both new and legacy fields when possible.
- Prefer compatibility mapping over deleting old fields.
- Default aspect ratio should be `16:9` unless project code says otherwise.
- Default quality should be `standard` unless project code says otherwise.
- If the user selects a ratio such as `1:1`, `3:4`, `4:3`, `9:16`, or `16:9`, pass it through to the provider adapter.
- Do not send only `prompt` if the provider supports ratio, resolution, image, or quality fields.

---

## 12. Git Rules

Before editing, check:

```cmd
git status
```

Before finishing, inspect:

```cmd
git diff
```

Use Conventional Commits:

```txt
feat: add new feature
fix: fix bug
docs: update documentation
chore: update config, scripts, or dependencies
test: add or update tests
refactor: restructure code without behavior change
style: formatting or visual-only changes
perf: improve performance
```

Examples:

```cmd
git add path\to\file1 path\to\file2
git commit -m "fix: preserve queued video task polling"
git push
```

Rules:

- One commit should do one type of change.
- Do not mix unrelated changes.
- Prefer staging exact files.
- Do not use `git add .` when unrelated, generated, local config, or secret files are present.
- Do not run destructive Git commands without explicit user confirmation.
- Do not overwrite user changes.
- If uncommitted user changes exist, protect them.

Never run these without explicit confirmation:

```cmd
git reset --hard
git clean -fd
git push --force
git rebase
```

Never use these bulk deletion commands:

```txt
del /s
rd /s
rmdir /s
Remove-Item -Recurse
rm -rf
```

If multiple files need to be deleted, stop and ask the user first. Only delete one explicit file path at a time when deletion is approved.

---

## 13. Testing and Verification

Run available checks when reasonable:

```cmd
npm run build
npm run lint
npm test
```

If no check command exists, do not invent results.

Say clearly:

```txt
No test command was found. I performed a static review only.
```

For API or polling changes, verify:

- Request fields are preserved.
- Response fields are compatible.
- Task status transitions are correct.
- Provider errors are stored.
- Frontend can display queued, processing, completed, failed, and timeout states.
- Logs are useful and do not expose secrets.

---

## 14. Documentation Rules

Do not create long docs for small changes.

Update docs when changing:

- Provider integrations
- Environment variables
- API contracts
- Task status logic
- Deployment steps
- Supabase or storage setup
- CMD scripts
- README instructions

Preferred doc folders if needed:

```txt
docs/
  api/
  integration/
  guides/
  architecture/
```

Follow the existing project structure if one already exists.

---

## 15. Dependency and Architecture Rules

- Do not add dependencies casually.
- Explain why a new dependency is needed.
- Reuse existing utilities, services, and provider adapters.
- Avoid duplicate helper functions.
- Keep frontend, backend, provider, and storage concerns separated.
- Do not import server-only code into frontend bundles.
- Do not mix UI-only changes with backend refactors.
- Do not mix bug fixes with large architecture changes.

---

## 16. Security Rules

Avoid:

- Leaking API keys
- Committing `.env`
- Exposing service role keys to the frontend
- Logging full tokens
- Trusting user input without validation
- XSS
- SQL injection
- SSRF
- Unsafe file upload handling

When logging secrets, redact them:

```txt
sk-****abcd
```

---

## 17. Common User Requests

### 17.1 Start local server

Prefer:

```cmd
npm run dev
```

If creating a script:

```cmd
@echo off
chcp 65001
npm run dev
pause
```

---

### 17.2 One-click commit and push

Prefer a `.cmd` script:

```cmd
@echo off
chcp 65001

git status

set /p msg=Enter commit message: 
if "%msg%"=="" (
  echo Commit message cannot be empty.
  pause
  exit /b 1
)

echo Stage exact files manually before running this script.
git status
git commit -m "%msg%"
git push

pause
```

Do not force push.

---

### 17.3 Fix encoding corruption

Workflow:

1. Inspect the file.
2. Determine whether the source file is corrupted or only terminal output is corrupted.
3. Preserve valid Chinese text.
4. Restore UTF-8 if needed.
5. Review diff carefully.

Do not rewrite the whole file unless necessary.

---

### 17.4 Improve frontend visuals

Workflow:

1. Locate the component and style files.
2. Make visual-only changes.
3. Do not touch API logic.
4. Do not touch task state logic.
5. Preserve existing UI text.
6. Check responsive behavior.

---

### 17.5 Add a new model provider

Before implementation, provide a short plan covering:

- Provider name
- Required environment variables
- Request field mapping
- Response field mapping
- Task status mapping
- Error handling
- Frontend model option changes
- Verification steps

Do not hardcode provider logic into UI components.

---

## 18. Forbidden Actions

Do not do any of the following unless explicitly requested:

- Delete large parts of the project
- Rewrite the whole app
- Change real secrets
- Commit `.env`
- Force push
- Reset Git history
- Remove polling logic
- Remove task records
- Delete generated outputs
- Change user-visible UI text
- Treat `queued` as `failed`
- Treat local timeout as upstream failure
- Change file encoding in a way that corrupts Chinese
- Introduce a large dependency for a small visual change

---

## 19. Response Style

When reporting back to the user:

- Use Chinese in chat unless the user asks otherwise.
- Keep the answer concise.
- Start with the result.
- Mention changed files.
- Mention verification commands and results.
- Mention risks or manual steps if any.
- Do not write long theory unless the user asks.

Recommended final response format:

```md
## Done

- Changed:
- Files:

## Verification

- `npm run build`: passed / failed / not run
- `npm run lint`: passed / failed / not run

## Notes

- Manual steps:
- Risks:
```

---

## 20. Default Behavior

Default to:

- Small, safe edits
- UTF-8
- CMD commands
- Clear provider logs
- Recoverable task states
- No force push
- No secret exposure
- No unnecessary refactor
- No unrelated UI text changes
- No deletion of polling or task history

---

## 21. Headroom Rules

- The project defaults to using the Headroom provider when model/provider choice is relevant.
- If the Headroom proxy is unavailable, clearly state that before falling back to ordinary model calls.
