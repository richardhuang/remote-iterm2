const { exec } = require('child_process');

const runAppleScript = (script) => {
    return new Promise((resolve, reject) => {
        exec(`/usr/bin/osascript -e '${script.replace(/'/g, "'\\''")}'`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
};

const iterm = {
    // Get all windows, tabs, and sessions
    getState: async () => {
        const script = `
            set output to ""
            tell application "iTerm"
                try
                    set winCount to count of windows
                    repeat with wIdx from 1 to winCount
                        set w to window wIdx
                        set winId to (id of w) as string
                        set isF to (frontmost of w) as string
                        try
                            set b to bounds of w
                            set output to output & "W:" & winId & ":" & isF & ":" & (item 1 of b) & ":" & (item 2 of b) & ":" & (item 3 of b) & ":" & (item 4 of b) & "\\n"
                        on error
                            set output to output & "W:" & winId & ":" & isF & ":0:0:800:600\\n"
                        end try
                        
                        try
                            set tabCount to count of tabs of w
                            set ct to current tab of w
                            repeat with tIdx from 1 to tabCount
                                set t to tab tIdx of w
                                if t is ct then
                                    set isS to "true"
                                else
                                    set isS to "false"
                                end if
                                set output to output & "T:" & tIdx & ":" & winId & "-" & tIdx & ":" & isS & "\\n"

                                try
                                    set sessCount to count of sessions of t
                                    repeat with sIdx from 1 to sessCount
                                        set s to session sIdx of t
                                        set sessId to (id of s) as string
                                        set sessName to (name of s) as string
                                        set output to output & "S:" & sessId & ":" & sessName & "\\n"
                                    end repeat
                                on error
                                end try
                            end repeat
                        on error
                        end try
                    end repeat
                on error errMsg
                    set output to "ERROR:" & errMsg
                end try
            end tell
            return output
        `;
        try {
            const result = await runAppleScript(script);
            if (result.startsWith('ERROR:')) return [];
            return parseState(result);
        } catch (err) {
            return [];
        }
    },

    // Get content of a specific session (truncated for performance)
    getContent: async (sessionId) => {
        let script = '';
        if (sessionId && sessionId !== 'undefined') {
            script = `
                tell application "iTerm"
                    try
                        repeat with w in windows
                            repeat with t in tabs of w
                                repeat with s in sessions of t
                                    if ((id of s) as string) is "${sessionId}" then
                                        set cont to contents of s
                                        set paraList to paragraphs of cont
                                        if (count of paraList) > 1000 then
                                            set lastParas to items -1000 thru -1 of paraList
                                            set AppleScript's text item delimiters to linefeed
                                            return lastParas as text
                                        else
                                            return cont
                                        end if
                                    end if
                                end repeat
                            end repeat
                        end repeat
                    on error
                    end try
                    return contents of current session of current window
                end tell
            `;
        } else {
            script = `
                tell application "iTerm"
                    set cont to contents of current session of current window
                    set paraList to paragraphs of cont
                    if (count of paraList) > 1000 then
                        set lastParas to items -1000 thru -1 of paraList
                        set AppleScript's text item delimiters to linefeed
                        return lastParas as text
                    else
                        return cont
                    end if
                end tell
            `;
        }
        
        try {
            return await runAppleScript(script);
        } catch (err) {
            return "";
        }
    },

    executeCommand: async (sessionId, command) => {
        let script = '';
        if (sessionId && sessionId !== 'undefined') {
            script = `
                tell application "iTerm"
                    try
                        repeat with w in windows
                            repeat with t in tabs of w
                                repeat with s in sessions of t
                                    if ((id of s) as string) is "${sessionId}" then
                                        tell s to write text "${command.replace(/"/g, '\\"')}"
                                        return "OK"
                                    end if
                                end repeat
                            end repeat
                        end repeat
                    on error
                    end try
                    tell current session of current window to write text "${command.replace(/"/g, '\\"')}"
                end tell
            `;
        } else {
            script = `tell application "iTerm" to tell current session of current window to write text "${command.replace(/"/g, '\\"')}"`;
        }
        return runAppleScript(script);
    },

    newTab: async (windowId) => {
        if (windowId) {
            const script = `
                tell application "iTerm"
                    repeat with w in windows
                        if ((id of w) as string) is "${windowId}" then
                            tell w to create tab with default profile
                            exit repeat
                        end if
                    end repeat
                end tell
            `;
            return runAppleScript(script);
        }
        return runAppleScript(`tell application "iTerm" to tell current window to create tab with default profile`);
    },

    switchTab: async (direction) => {
        const script = `
            tell application "iTerm"
                tell current window
                    set tabCount to count of tabs
                    set ct to current tab
                    repeat with i from 1 to tabCount
                        if tab i is ct then
                            if "${direction}" is "next" then
                                set newIdx to (i mod tabCount) + 1
                            else
                                set newIdx to ((i - 2 + tabCount) mod tabCount) + 1
                            end if
                            select tab newIdx
                            exit repeat
                        end if
                    end repeat
                end tell
            end tell
        `;
        return runAppleScript(script);
    },

    closeTab: async () => {
        const script = `
            tell application "iTerm"
                tell current session of current window
                    close
                end tell
            end tell
        `;
        return runAppleScript(script);
    },

    focus: async (windowId, tabIndex) => {
        if (!windowId) return;
        const script = `
            tell application "iTerm"
                activate
                repeat with w in windows
                    if ((id of w) as string) is "${windowId}" then
                        select w
                        if ${tabIndex} is not 0 then
                            select tab ${tabIndex} of w
                        end if
                        exit repeat
                    end if
                end repeat
            end tell
        `;
        return runAppleScript(script);
    },

    // Set iTerm tab color via escape sequences written to session TTY
    setTabColor: async (sessionId, r, g, b) => {
        if (!sessionId || sessionId === 'undefined') return;
        const script = `
            tell application "iTerm"
                try
                    repeat with w in windows
                        repeat with t in tabs of w
                            repeat with s in sessions of t
                                if ((id of s) as string) is "${sessionId}" then
                                    set ttyPath to tty of s
                                    do shell script "printf '\\\\033]6;1;bg;red;brightness;${r}\\\\007\\\\033]6;1;bg;green;brightness;${g}\\\\007\\\\033]6;1;bg;blue;brightness;${b}\\\\007' > " & ttyPath
                                    return
                                end if
                            end repeat
                        end repeat
                    end repeat
                on error
                end try
            end tell
        `;
        return runAppleScript(script);
    },

    // Send raw text/escape sequences to a session (for Ctrl+C, arrow keys, etc.)
    sendKeys: async (sessionId, keys) => {
        // Convert keys string to an AppleScript expression with proper character codes
        // Control chars are sent via iTerm's write text using character id N
        const parts = [];
        let printable = '';

        const flushPrintable = () => {
            if (printable) {
                parts.push('"' + printable.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
                printable = '';
            }
        };

        for (let i = 0; i < keys.length; i++) {
            // Check for \xHH escape sequences first
            if (keys[i] === '\\' && i + 1 < keys.length) {
                if (keys[i + 1] === 'x' && i + 3 < keys.length) {
                    const hex = keys.substring(i + 2, i + 4);
                    const code = parseInt(hex, 16);
                    if (!isNaN(code)) {
                        flushPrintable();
                        if (code === 10 || code === 13) {
                            // Enter: use newline YES
                            parts.push('NL');
                        } else {
                            parts.push('CID:' + code);
                        }
                        i += 3;
                        continue;
                    }
                }
                if (keys[i + 1] === 'n') {
                    flushPrintable();
                    parts.push('NL');
                    i += 1;
                    continue;
                }
                if (keys[i + 1] === 't') {
                    flushPrintable();
                    parts.push('CID:9');
                    i += 1;
                    continue;
                }
                if (keys[i + 1] === 'r') {
                    flushPrintable();
                    parts.push('NL');
                    i += 1;
                    continue;
                }
            }

            const code = keys.charCodeAt(i);
            if (code < 32 || code === 127) {
                flushPrintable();
                if (code === 10 || code === 13) {
                    parts.push('NL');
                } else {
                    parts.push('CID:' + code);
                }
            } else {
                printable += keys[i];
            }
        }
        flushPrintable();

        if (parts.length === 0) return;

        // Build AppleScript: send each part sequentially
        const buildSendStatements = (sessionTarget) => {
            return parts.map(p => {
                if (p === 'NL') {
                    return `tell ${sessionTarget} to write text ""`;
                } else if (p.startsWith('CID:')) {
                    const charId = p.substring(4);
                    return `tell ${sessionTarget} to write text (character id ${charId}) newline NO`;
                } else {
                    return `tell ${sessionTarget} to write text ${p} newline NO`;
                }
            }).join('\n');
        };

        let sessionTarget;
        if (sessionId && sessionId !== 'undefined') {
            sessionTarget = 's';
            const script = `
                tell application "iTerm"
                    try
                        repeat with w in windows
                            repeat with t in tabs of w
                                repeat with s in sessions of t
                                    if ((id of s) as string) is "${sessionId}" then
                                        ${buildSendStatements('s')}
                                        return
                                    end if
                                end repeat
                            end repeat
                        end repeat
                    on error
                    end try
                    ${buildSendStatements('current session of current window')}
                end tell
            `;
            return runAppleScript(script);
        } else {
            sessionTarget = 'current session of current window';
            const script = `
                tell application "iTerm"
                    ${buildSendStatements(sessionTarget)}
                end tell
            `;
            return runAppleScript(script);
        }
    },

    getScreenSize: async () => {
        try {
            const result = await runAppleScript(`tell application "Finder" to get bounds of window of desktop`);
            const parts = result.split(',').map(s => parseInt(s.trim()));
            return { width: parts[2] || 1470, height: parts[3] || 956 };
        } catch {
            return { width: 1470, height: 956 };
        }
    },

    // Get session metadata (rows, columns, is at shell prompt)
    getSessionInfo: async (sessionId) => {
        if (!sessionId || sessionId === 'undefined') return null;
        const script = `
            tell application "iTerm"
                try
                    repeat with w in windows
                        repeat with t in tabs of w
                            repeat with s in sessions of t
                                if ((id of s) as string) is "${sessionId}" then
                                    set r to rows of s
                                    set c to columns of s
                                    try
                                        set sp to (is at shell prompt of s) as string
                                    on error
                                        set sp to "missing value"
                                    end try
                                    return (r as string) & "," & (c as string) & "," & sp
                                end if
                            end repeat
                        end repeat
                    end repeat
                on error
                end try
            end tell
            return ""
        `;
        try {
            const result = await runAppleScript(script);
            if (!result) return null;
            const [rowsStr, colsStr, spStr] = result.split(',');
            let atShellPrompt = null;
            if (spStr === 'true') atShellPrompt = true;
            else if (spStr === 'false') atShellPrompt = false;
            // spStr === 'missing value' or anything else → null
            return {
                rows: parseInt(rowsStr) || 24,
                columns: parseInt(colsStr) || 80,
                atShellPrompt
            };
        } catch (err) {
            return null;
        }
    },

    renameSession: async (sessionId, name) => {
        if (!sessionId || sessionId === 'undefined') return;
        const safeName = name.replace(/"/g, '\\"');
        const script = `
            tell application "iTerm"
                try
                    repeat with w in windows
                        repeat with t in tabs of w
                            repeat with s in sessions of t
                                if ((id of s) as string) is "${sessionId}" then
                                    set name of s to "${safeName}"
                                    return "OK"
                                end if
                            end repeat
                        end repeat
                    end repeat
                on error
                end try
            end tell
        `;
        return runAppleScript(script);
    }
};

function parseState(raw) {
    if (!raw) return [];
    const lines = raw.split('\n');
    const state = [];
    let currentWindow = null;
    let currentTab = null;

    lines.forEach(line => {
        if (line.startsWith('W:')) {
            const parts = line.substring(2).split(':');
            const bounds = parts.length >= 6 ? {
                x: parseInt(parts[2]) || 0,
                y: parseInt(parts[3]) || 0,
                w: (parseInt(parts[4]) || 800) - (parseInt(parts[2]) || 0),
                h: (parseInt(parts[5]) || 600) - (parseInt(parts[3]) || 0),
            } : { x: 0, y: 0, w: 800, h: 600 };
            currentWindow = { id: parts[0].trim(), isFront: parts[1] === 'true', tabs: [], bounds };
            state.push(currentWindow);
        } else if (line.startsWith('T:')) {
            const parts = line.substring(2).split(':');
            currentTab = { index: parseInt(parts[0]), id: parts[1], isSelected: parts[2] === 'true', sessions: [] };
            if (currentWindow) currentWindow.tabs.push(currentTab);
        } else if (line.startsWith('S:')) {
            const parts = line.substring(2).split(':');
            const session = { id: parts[0], name: parts.slice(1).join(':').trim() };
            if (currentTab) currentTab.sessions.push(session);
        }
    });
    return state;
}

module.exports = iterm;
