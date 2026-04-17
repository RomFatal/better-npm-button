# Better Npm Button

Better Npm Button is a lightweight VS Code extension that adds a dedicated `Run` Activity Bar view for `package.json` scripts.

## Features

- Native Activity Bar icon and view container titled `Run`
- Shows scripts from the root `package.json` or from every package in the workspace
- Theme-aware icon mode or plain text mode
- One click to run a script in the integrated terminal
- Auto-detects `npm`, `pnpm`, `yarn`, and `bun`
- Refresh and rerun-last commands in the view title
- Auto-refreshes when `package.json` files change

## Settings

- `runSidebar.scope`: `root` or `all`
- `runSidebar.itemStyle`: `icon` or `text`
- `runSidebar.packageManager`: `auto`, `npm`, `pnpm`, `yarn`, or `bun`
- `runSidebar.terminalMode`: `reuse` or `new` (`new` is the default so the terminal title matches the script name)
- `runSidebar.focusTerminal`: `true` or `false`

## Behavior

- `root` scope reads only the root `package.json` from the first workspace folder.
- `all` scope scans all workspace folders and groups scripts by package.
- Clicking a script sends the matching command to the VS Code integrated terminal.
- In `new` terminal mode, the terminal title is the script name in `root` scope and `package: script` in `all` scope.
- In `reuse` mode, VS Code keeps a shared static terminal title because the public API does not support renaming an existing terminal programmatically.
