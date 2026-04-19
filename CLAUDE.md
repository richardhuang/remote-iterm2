# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

remote-iterm2 is a web-based remote control for macOS iTerm2, optimized for mobile phones. A React PWA frontend communicates with an Express backend over Socket.IO; the backend controls iTerm2 via AppleScript executed through `/usr/bin/osascript`.

## Development Commands

```bash
# Install all dependencies (server + client)
cd server && npm install && cd ../client && npm install

# Build client (must run before server can serve UI)
cd client && npx tsc && vite build && cd ..

# Start server (single port 7291, serves built client + WebSocket)
./iterm-server start

# Stop / restart
./iterm-server stop
./iterm-server restart

# Client dev server (port 7292, separate from backend)
cd client && npm run dev
```

No test framework is configured.

## Architecture

**Two-process design, single production port:**
- **Production:** Express on port 7291 serves built static files from `client/dist` and handles Socket.IO. No separate client server needed.
- **Client dev only:** Vite dev server on port 7292 for hot reload during frontend development.

**Server (`server/`):**
- `index.js` — Express + Socket.IO server. Handles all WebSocket events (execute, switchTab, sendKeys, focus, broadcast, etc.). Polls iTerm2 state every 1s and terminal content every 150ms, broadcasting changes to connected clients.
- `iterm.js` — AppleScript interface. Every method builds and executes an AppleScript string via `child_process.exec`. State is parsed from a custom line-based format (`W:` windows, `T:` tabs, `S:` sessions). Key methods: `getState`, `getContent`, `executeCommand`, `sendKeys` (handles control chars via `character id N`), `setTabColor` (escape sequences via TTY), `focus`, `renameSession`.

**Client (`client/`):**
- Single-page React app in `client/src/App.tsx` (~53KB, all UI logic in one file). Uses Socket.IO client for real-time communication. Tailwind CSS for styling. PWA with manifest and icons.

**CLI entrypoint (`iterm-server`):**
- Bash script that manages the server process (start/stop/restart), prints a QR code for mobile access, and resolves symlinks for global npm installs.

## Key Design Details

- All iTerm2 interaction is AppleScript — there is no native module or C binding. The `runAppleScript` helper in `iterm.js` shells out to `/usr/bin/osascript`.
- `sendKeys` in `iterm.js` parses key strings into printable text and control characters, sending control chars via iTerm's `write text (character id N) newline NO` and Enter via `write text ""` (iTerm's default adds newline).
- The server tracks `activeSessionId` (the frontmost window's selected tab's first session) and uses it for content polling.
- Window tab colors are assigned by window index from a fixed palette (`TAB_COLORS`) when focusing from the web UI.
- Content is truncated to the last 5000 characters in `getContent` for performance.
- The project requires macOS (darwin) and Node.js >= 18.
