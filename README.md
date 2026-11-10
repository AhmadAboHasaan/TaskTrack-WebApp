# TaskTrack

A small task manager for an Operating Systems lab. Built with Node.js, Express, and plain HTML, CSS, and JavaScript. No database, build step, CDN, or paid service is required.

## Install and run

Install a supported Node.js LTS release (Node.js 24 is used by Docker and CI), then run from this directory:

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

## Docker

Install Docker Engine or Docker Desktop with Linux containers, and start it before running these commands from the project directory. Host Node.js is only needed for the npm shortcuts; the direct Docker commands work without it. Stop any local TaskTrack server using port 3000 first.

Build and run:

```sh
docker build -t tasktrack:latest .
docker run --detach --name tasktrack --publish 3000:3000 --mount type=volume,source=tasktrack-data,target=/app/data tasktrack:latest
```

Equivalent npm shortcuts (use `npm.cmd` in PowerShell if needed):

```sh
npm run docker:build
npm run docker:run
```

Open http://localhost:3000. The health endpoint is http://localhost:3000/health and should return HTTP 200 with `{"status":"ok"}`. Inspect logs and the Docker health status:

```sh
docker logs tasktrack
docker inspect --format "{{.State.Health.Status}}" tasktrack
```

The image uses two stages based on `node:24-alpine`. The dependencies stage runs `npm ci --omit=dev`; the runtime stage contains production dependencies, `package.json`, and application source. It runs `npm start` as the non-root `node` user. `/app/data` is created with `node:node` ownership before switching users, so Docker initializes a new named volume with writable ownership. Existing volumes must already be writable by the image's `node` user (UID/GID 1000); bind-mounted host folders also require suitable permissions. No root runtime or world-writable permissions are needed.

The built-in health check requests `/health` with Node.js every 30 seconds after a 10-second startup grace period, with a request timeout of 3 seconds. Connection errors, timeouts, and non-200 responses fail the check; three consecutive failures mark the container unhealthy. Docker does not automatically restart a container merely because it is unhealthy.

Stop and remove the container while preserving saved tasks:

```sh
npm run docker:stop
```

Or run these commands separately:

```sh
docker stop tasktrack
docker rm tasktrack
```

The stop shortcut expects the named container to exist. Recreate it with `npm run docker:run`; the `tasktrack-data` volume remains attached to the new container. Rebuild the image after source changes and remove/recreate the container to use the new image.

### Docker Compose

Use Compose as an alternative to the direct run commands. Both use the same image (`tasktrack:latest`), container (`tasktrack`), and volume (`tasktrack-data`). Remove the container from the previous method before switching, and run only one TaskTrack server against this volume.

```sh
docker compose config --quiet
docker compose up --build --detach
docker compose ps
docker compose logs tasktrack
```

The app and health URLs are the same as above. Stop and remove the Compose container and network, keeping the named volume:

```sh
docker compose down
```

Run `docker compose up --build --detach` again to restore the application with its saved tasks. The volume stores `/app/data/tasks.json` and is independent of the local `data/` directory. Local runtime tasks are excluded from the Docker build context and are not bundled into the image.

### Ports and environment

The container defaults to `NODE_ENV=production`, `PORT=3000`, and `DATA_DIR=/app/data`. The application listens on `0.0.0.0` inside the container. Publishing a port is separate from `EXPOSE`; `--publish 3000:3000` maps host port 3000 to container port 3000.

To use host port 3001 while leaving the container's port unchanged:

```sh
docker run --detach --name tasktrack --publish 3001:3000 --mount type=volume,source=tasktrack-data,target=/app/data tasktrack:latest
```

With Compose, set `HOST_PORT` before startup. PowerShell:

```powershell
$env:HOST_PORT = '3001'
docker compose up --build --detach
```

macOS/Linux:

```sh
HOST_PORT=3001 docker compose up --build --detach
```

Then use http://localhost:3001 and http://localhost:3001/health. Compose also supports `HOST_PORT=3001` in a local `.env` file; that file is excluded from Git and the image.

To override the internal port, pass `--env PORT=4000` with `--publish 3001:4000` to `docker run`; the health check follows `PORT`. Compose deliberately fixes the internal port at 3000, so an internal-port change there requires updating both its `environment.PORT` and the target port in `ports`. Change production settings with `--env NAME=value` for Docker or the service's `environment` mapping for Compose. If overriding `DATA_DIR`, also mount persistent writable storage at that path; keep the default `/app/data` for the provided named-volume setup. `.env` files are not read by the application itself.

### Optional: delete saved tasks

**Deleting the volume permanently deletes every saved task in that volume.** First remove its container using the applicable stop/remove commands above, then, only if you want to erase saved tasks:

```sh
docker volume rm tasktrack-data
```

Alternatively, `docker compose down --volumes` removes the Compose container, network, and its task volume together, also deleting all saved tasks. Ordinary `docker compose down` and `npm run docker:stop` preserve the volume. A subsequent run after volume deletion starts with an empty task list.

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes and pull requests. It checks out the source, sets up Node.js 24, installs from the lockfile with `npm ci`, runs `npm test`, and builds `tasktrack:latest`. It does not publish an image or deploy the app. The workflow will execute on GitHub only after the files are added to a repository and pushed in a later assignment phase.

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
Dockerfile            Multi-stage production image
.dockerignore         Minimal Docker build context
docker-compose.yml    Local image and persistent named volume
.github/workflows/ci.yml  Tests and Docker build
```

## Storage and limits

Run one server process per data directory. Writes are queued within that process and saved using a temporary file followed by rename, avoiding partially written JSON during ordinary writes. This is a small local lab application, with all tasks held in memory; it is not designed for multiple server processes or large datasets. There is no authentication, user separation, or undo. Anyone who can reach the server can manage the shared task list. Use it on a trusted machine/network.

Back up `tasks.json` if needed. Invalid existing JSON causes startup to fail with an error instead of replacing the file. Atomic rename is not a substitute for backups or a guarantee against power loss. `/health` indicates the server is running; it does not recheck disk writability.

See [docs/notes.md](docs/notes.md) for checks actually performed and remaining verification limits. No commits, pushes, pull requests, or deployment were performed in the containerization phase.
