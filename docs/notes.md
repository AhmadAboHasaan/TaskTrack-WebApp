# Implementation and verification notes

Initial application verification: November 9, 2026 with Node.js v24.11.0 and npm 11.6.1 on Windows. Containerization verification is recorded separately below.

## Completed

- Implemented the Express API, server-side validation, JSON file persistence, and plain HTML/CSS/JavaScript interface.
- Added a responsive light theme with teal accents, task cards, priority labels, filters, overview counts, and loading/empty/error states.
- Installed dependencies using `npm.cmd install`; generated `package-lock.json`. npm reported zero known vulnerabilities at installation time.
- `node --check src/server.js` and `node --check src/public/app.js` passed.
- `npm.cmd test` passed the API integration test. Its assertions cover automatic nested data directory/file creation; health response and status; HTML/JS/CSS serving; empty list; valid creation and trimming; blank, wrong-type, overlong, and invalid-priority input; malformed JSON; oversized bodies; completion; returning to pending; deletion; missing tasks/routes; 12 concurrent creates without lost records; and persistence of both task state and deletion across process restarts.
- The test also forces a filesystem write failure, checks the 500 response and unchanged in-memory/on-disk data, then verifies that the write queue recovers.
- Started the application with `npm.cmd start` using default settings. Independently checked the health JSON, empty default `data/tasks.json`, and the listening socket at `0.0.0.0:3000`.

## Verification limits

Browser integration reported that its access host was unavailable. Native Chrome inspection was then attempted, but the automation tool failed to capture a minimized Chrome window. No successful browser interaction or visual inspection was performed. Responsive behavior, browser filters/count updates, keyboard interactions, and visible error/loading states still need the manual checks in README.md.

No screenshots were captured during the initial automated verification. The later workspace inspection found three screenshot files, listed in the manual verification update below; their contents were not inspected in this update.

## Design and operating limits

The server queues mutations and renames a temporary file over the task file before returning success. It updates its in-memory list only after persistence succeeds. This prevents lost updates within one process and preserves existing tasks on ordinary write failures. Run only one process per data directory. There is no cross-process lock, database, authentication, per-user separation, undo, or power-loss durability guarantee. Large task lists are outside the intended lab scope.

The default runtime data, dependencies, npm cache, environment files, and logs are ignored by `.gitignore`. Custom data directories within this project need their own ignore entry.

During the initial application phase, no Docker files were created. Git was not initialized; no commits, remotes, pushes, or deployments were performed in that phase.

## Containerization phase — November 10, 2026

Inspected the existing server, public source, dependency manifests, integration tests, README, and ignore rules before changes. The application source and existing tests were left unchanged.

Added:

- A two-stage `node:24-alpine` Dockerfile. The dependencies stage installs from the lockfile using `npm ci --omit=dev`. The runtime stage copies only production dependencies, the package manifest, and application source, sets production environment defaults, prepares `/app/data` with `node:node` ownership, and runs `npm start` as `node`.
- A Node.js HTTP health check that follows `PORT` and fails on non-200 status, connection errors, and request timeout.
- A build-context allowlist in `.dockerignore` excluding local runtime data, environment files, dependencies, Git metadata, logs, screenshots, tests, and other unnecessary files.
- Compose configuration and cross-platform npm shortcuts using image `tasktrack:latest`, container `tasktrack`, and named volume `tasktrack-data` at `/app/data`.
- A GitHub Actions workflow for pushes and pull requests: Node.js 24, `npm ci`, `npm test`, then the Docker image build. It does not publish or deploy.
- README instructions for running, configuration, stopping/removing containers, preserving data, and explicitly optional destructive volume removal.

### Checks performed

- Existing `npm.cmd test` passed before changes and again after a clean lockfile installation with `npm.cmd ci --offline --cache .npm-cache`.
- `docker --version` reported Docker 29.0.1; `docker compose version` reported v2.40.3-desktop.1.
- `docker compose config --quiet` passed. Resolved Compose output confirmed the image, container, named volume, environment, default `3000:3000` mapping, and alternate `3001:3000` mapping when `HOST_PORT=3001`.
- Extracted the actual health-check command from the Dockerfile and executed it using host Node.js against temporary HTTP fixtures. It exited successfully for HTTP 200 and failed for HTTP 503 and a refused connection. This was a host-side check, not a container health-status test.
- Attempted `docker info` and `npm.cmd run docker:build`. Both failed to connect to the Docker Desktop Linux engine named pipe (`//./pipe/dockerDesktopLinuxEngine`), which the system reported as not found. The build did not reach image construction. This is an observed local engine-access failure, not evidence of a Dockerfile or application defect.

### Limits of the initial automated checks

No image was built or run successfully during the initial automated checks. Later successful manual checks are recorded below. Container user identity, named-volume ownership at runtime, and container task operations were not verified by those automated checks. The GitHub Actions workflow was not executed during those checks. No new browser checks or screenshots were performed by the agent.

Fresh named-volume ownership is prepared by the Dockerfile; an existing volume or a bind mount with different ownership may require separate permission preparation. Verifying task persistence requires confirming that previously saved tasks remain after container recreation. Reusing the volume and observing a healthy container alone do not establish that result.

No commits, pushes, pull requests, remote changes, or deployments were performed by the agent in this phase.

### Subsequent manual verification (reported by the user)

- The Docker image build succeeded after Docker Desktop was started.
- The container was removed and recreated using the same named volume.
- The recreated container reports `healthy` and runs on port 3000.
- Task persistence across container recreation is **manually verified by the user**: existing tasks remained visible after removing and recreating the container with the same named volume. This confirms persistence for the tested container recreation. The earlier host integration tests verified persistence across server process restarts, which is a separate check.

The initial error was a connection failure to the Docker Desktop Linux engine named pipe, `//./pipe/dockerDesktopLinuxEngine` (also shown as `npipe:////./pipe/dockerDesktopLinuxEngine`). Docker CLI and Compose were installed, but the engine pipe was unavailable, and the system reported that it could not find the file specified. Starting Docker Desktop made the Linux engine available and resolved the connection issue, allowing the subsequent image build to succeed. The failed attempt did not reach the Dockerfile build steps.

### Git/GitHub lesson and current working state

The user reported that pushing initially failed because Git authenticated to GitHub as the wrong account. Commit identity and authentication are separate: `git config user.name` and `git config user.email` set the author/committer identity recorded in commits; the credentials used for the remote determine which GitHub account authenticates and whether it has permission to push. Changing commit identity does not switch the authenticated GitHub account. No authentication correction or successful push is claimed in this update.

Read-only Git inspection for this update found:

- Current branch: `feat/docker-setup`.
- Modified tracked files: `README.md`, `docs/notes.md`, and `package.json`.
- Untracked files/directories: `.dockerignore`, `.github/`, `Dockerfile`, `docker-compose.yml`, and `docs/screenshots/01-docker-build.png`, `docs/screenshots/02-container-running.png`, and `docs/screenshots/03-app-working.png`.
- No staged changes were shown.

Only `docs/notes.md` was edited in this update. No commit or push was performed.
