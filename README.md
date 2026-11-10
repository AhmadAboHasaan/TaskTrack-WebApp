# TaskTrack

A small task manager for an Operating Systems lab. Built with Node.js, Express, and plain HTML, CSS, and JavaScript. No database, build step, CDN, or paid service is required.

## Install and run

Install Node.js 20 or newer (Node.js 24 was used for verification), then run from this directory:

```sh
npm install
npm start
```

Open http://localhost:3000. Stop the server with Ctrl+C. On PowerShell systems that restrict npm scripts, use `npm.cmd install`, `npm.cmd start`, and `npm.cmd test`.

The server listens on `0.0.0.0`. `PORT` defaults to `3000`. `DATA_DIR` defaults to this project's `data/` directory; relative overrides resolve from the current working directory. The directory and `tasks.json` are created automatically. Environment variables can be set in the shell; `.env` files are not loaded automatically.

PowerShell example:

```powershell
$env:PORT = '3001'
$env:DATA_DIR = 'D:\tasktrack-data'
npm.cmd start
```

macOS/Linux example:

```sh
PORT=3001 DATA_DIR=./local-data npm start
```

If you store data inside the project outside `data/`, add that location to `.gitignore` before tracking files.

## Use

Add a title (1–120 characters), an optional description (up to 1,000 characters), and a low, medium, or high priority. Use the round checkbox to switch between completed and pending, the trash button to delete, and the All / Pending / Completed filters to change the view. Counts always summarize every task. Deletion is immediate.

The interface shows loading, empty, saving, and error states. Failed writes preserve the existing list. A failed initial load offers Retry. Task text is rendered as text, never as HTML.

## Basic testing

```sh
npm test
```

The integration test starts a separate server on a temporary port with a temporary data directory. It checks health, static assets, automatic storage creation, input validation, malformed and oversized JSON, creation, completion, returning to pending, deletion, missing records, concurrent writes, and persistence across server restarts. It also forces a disk write failure and checks that tasks remain unchanged and later writes recover. It cleans up its server and temporary data.

Manual checks with `npm start`:

1. Open the app, create tasks with different priorities, and confirm the counts.
2. Complete a task, switch each filter, then mark it pending again.
3. Refresh the page and restart the server; tasks should remain.
4. Delete a task and confirm it stays deleted after refresh.
5. Check the layout in a narrow browser window and use Tab to navigate controls.
6. Stop the server while the page remains open and attempt an action to see the connection error.

Health check (PowerShell):

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Expected: HTTP 200 with `{"status":"ok"}`.

## API

| Method | Route | Body / result |
| --- | --- | --- |
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/api/tasks` | `{ "tasks": [...] }` |
| POST | `/api/tasks` | `{ "title": "OS lab", "description": "Optional", "priority": "medium" }`; returns 201 and `{ "task": ... }` |
| PATCH | `/api/tasks/:id` | `{ "completed": true }`; returns `{ "task": ... }` |
| DELETE | `/api/tasks/:id` | Returns 204 |

Errors return `{ "error": "message" }` with an appropriate HTTP status. New tasks default to medium priority and pending status. Each task has a generated UUID and creation timestamp.

## Project structure

```text
src/server.js          Express API and JSON storage
src/public/index.html  Accessible page structure
src/public/styles.css  Responsive light theme
src/public/app.js      Browser behavior
data/                 Runtime tasks.json (ignored by Git)
docs/screenshots/      Real screenshots, if captured
docs/notes.md          Verification record and limitations
tests/api.test.js     Automated integration test
```

## Storage and limits

Run one server process per data directory. Writes are queued within that process and saved using a temporary file followed by rename, avoiding partially written JSON during ordinary writes. This is a small local lab application, with all tasks held in memory; it is not designed for multiple server processes or large datasets. There is no authentication, user separation, or undo. Anyone who can reach the server can manage the shared task list. Use it on a trusted machine/network.

Back up `tasks.json` if needed. Invalid existing JSON causes startup to fail with an error instead of replacing the file. Atomic rename is not a substitute for backups or a guarantee against power loss. `/health` indicates the server is running; it does not recheck disk writability.

No Docker files, Git initialization, commits, remote configuration, or deployment are included in this phase.
