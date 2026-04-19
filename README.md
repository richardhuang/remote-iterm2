# remote-iterm2

Control your macOS iTerm2 from your phone over local network.

Fork of [remote-iterm](https://github.com/mammadovziya/remote-iterm) with mobile Safari fixes and key handling improvements.

## Install

```bash
npm install -g remote-iterm2
```

## Usage

```bash
remote-iterm2          # start
remote-iterm2 stop     # stop
remote-iterm2 restart  # restart
```

Open the printed URL on your phone (same Wi-Fi network).

## Configuration

Create `~/.remote-iterm2.json` to customize behavior:

```json
{ "tabColor": false }
```

| Option | Default | Description |
|--------|---------|-------------|
| `tabColor` | `true` | Automatically set tab background color when focusing a window. Set to `false` to preserve manually set tab colors. |

## What's Changed (v1.1.0)

- **Mobile Safari white screen fix** — Built frontend as static files served by Express on a single port, eliminating the socket.io-client ESM incompatibility with Vite dev server
- **Key sending overhaul** — Control chars (DEL, ESC, ^C, ^D, etc.) now sent via iTerm AppleScript `write text (character id N)`, Enter uses `write text ""` with default newline. Fixes DEL printing garbage and Enter not executing in apps like Claude Code
- **osascript path fix** — Uses full path `/usr/bin/osascript` to avoid "not found" errors in Node.js subprocesses
- **Quick Actions reorder** — Enter button moved to the front: Enter → ESC → ^C → ^D → ^Z → ^L
- **Single port mode** — Only port 7291 needed (no separate Vite dev server)

## Features

- Real-time terminal output with syntax coloring
- Tab management (create, close, rename via long-press)
- Multi-window support with spatial map
- Broadcast commands to multiple windows
- Command history with arrow navigation
- Virtual keyboard with terminal keys
- Quick action buttons (Enter, ESC, ^C, ^D, ^Z, ^L, etc.)
- Clipboard paste/copy
- Landscape mode optimized for iPhone
- Dynamic Island / notch safe area handling
- Connection latency indicator
- Screen wake lock
- Long-running command alert
- Scroll lock
- Split pane view
- PWA — add to home screen

## Requirements

- macOS with iTerm2
- Node.js >= 18
- Phone on the same Wi-Fi

## Manual Setup

```bash
git clone https://github.com/richardhuang/remote-iterm2.git
cd remote-iterm2
cd server && npm install && cd ../client && npm install
cd client && npx vite build && cd ..
./iterm-server
```

## Ports

- `7291` — HTTP server + WebSocket (single port)

## License

MIT
