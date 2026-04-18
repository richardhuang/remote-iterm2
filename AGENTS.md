# AGENTS.md

## Architecture

Two separate packages with independent `package.json` files — no monorepo tooling:

- **`server/`** — Express + Socket.IO server (CommonJS). Controls iTerm2 via AppleScript through `/usr/bin/osascript`.
- **`client/`** — React + TypeScript + Vite + Tailwind CSS frontend (ES modules). Builds to static files.
- **`remote-iterm2`** — Bash entry point. Handles start/stop/restart, PID file, QR code display. Referenced as `bin` in root `package.json`.

Express serves `client/dist/` as static files on port **7291**. Socket.IO shares the same port. No separate dev server in production.

## Key commands

```bash
# Install both server + client deps (root postinstall handles this automatically)
npm install

# Build client (required before server can serve anything)
cd client && npx tsc && npx vite build

# Start / stop / restart
remote-iterm2
remote-iterm2 stop
remote-iterm2 restart
```

There is no lint, test, or typecheck script at the root level. Client `tsconfig.json` has `strict: true` and `noUnusedLocals`/`noUnusedParameters` enabled — TypeScript will catch these during `npx tsc`.

## Gotchas

- **macOS + iTerm2 required.** The server shells out to `/usr/bin/osascript` (full path — don't use bare `osascript`, it fails in Node subprocesses).
- **`remote-iterm2` is a shell script**, not a Node file.
- **Client must be built before starting.** Server reads from `client/dist/`. If dist is missing or stale, you'll get a blank page.
- **Server is CommonJS (`"type": "commonjs"`), client is ES modules (`"type": "module"`).** Don't mix import syntax between them.
- **Port 7291** is hardcoded in `server/index.js:253` and `client/src/App.tsx:22-26` (SOCKET_URL logic).
- **`.npmrc` exists locally** with an npm auth token but is `.gitignore`'d — do not commit it.
- **No test suite exists.** `server/package.json` has a placeholder `test` script that just exits 1. `server/diag.js` can manually verify iTerm2 state queries.
- **Polling architecture.** Server polls terminal content every 150ms and state every 1s via `setTimeout` chains (not intervals — prevents overlap). Don't convert to `setInterval`.
- **Single file app.** Client is entirely in `client/src/App.tsx` (~1200 lines). There's no component directory or routing.
