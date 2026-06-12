# Canvas Project Library Design

## Goal

Add persistent canvas projects so nodes, edges, viewport, and uploaded media survive browser refreshes and server restarts. Provide immediate save with `Ctrl+S`, ten-minute autosave, mandatory naming for new projects, and a standalone project library.

## Persistence Model

Add a Prisma `Project` model with a generated ID, project name, serialized canvas JSON, `requiresRename`, timestamps, and `lastOpenedAt`. Canvas JSON contains only serializable node data, edges, and the React Flow viewport; callback functions are reattached when a project is loaded.

New projects are created as `empty space` with `requiresRename=true`. The canvas shows a blocking rename dialog after loading such a project. A valid non-empty name clears the flag.

## API

- `GET /api/projects`: list projects ordered by most recently opened.
- `POST /api/projects`: create an empty project.
- `GET /api/projects/[id]`: load one project.
- `PATCH /api/projects/[id]`: save canvas data, rename, and update last-opened time.
- `POST /api/uploads`: persist uploaded image/video files and return an `/api/files/...` URL.

## Canvas Behavior

On startup, the canvas selects the project in the `project` query parameter, then the last project ID in `localStorage`, then the most recently opened server project. If none exists, it creates one.

The canvas tracks save status. `Ctrl+S` or `Command+S` prevents the browser save dialog and saves immediately. A ten-minute interval saves the current canvas. Before unloading, the browser warns when changes have not been saved.

Local uploads are stored before nodes are created, replacing temporary `blob:` URLs with persistent file URLs.

## Project Library

The top-right project library button navigates to `/projects`. The standalone page shows project cards with name, update time, and node count. It supports creating a project, opening a project, and renaming a project.

## Error Handling

API failures leave the canvas intact and show a visible save error. Invalid project JSON falls back to an empty canvas without crashing. Missing projects fall back to the most recently opened project or create a new one.

## Verification

Static checks verify the model, routes, keyboard shortcut, autosave interval, and library page. Type checks and production builds must pass. Browser verification covers creating, renaming, saving, refreshing, opening from the library, and restoring nodes.
