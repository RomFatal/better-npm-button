# Better Npm Button

Better Npm Button adds a dedicated `Run` view to the VS Code Activity Bar so you can discover and run `package.json` scripts without switching back to the explorer or terminal first.

## Screenshot

![Better Npm Button Run view showing monorepo scripts](media/run-view-screenshot.png)

## Why It Exists

VS Code already exposes npm scripts in a few places, but the experience is easy to miss and gets noisy in multi-package workspaces. Better Npm Button keeps script execution in one predictable sidebar with a small set of controls:

- a dedicated Activity Bar entry
- root-only or whole-workspace package discovery
- one-click script execution
- rerun-last and refresh actions
- automatic `npm` / `pnpm` / `yarn` / `bun` detection

## Features

- Adds a `Run` Activity Bar container with a `Scripts` tree view
- Reads scripts from the root `package.json` or every package in the workspace
- Groups monorepo scripts by package when `runSidebar.scope` is set to `all`
- Supports `npm`, `pnpm`, `yarn`, and `bun`
- Lets you toggle a theme-aware play icon on or off
- Includes an optional button-style script UI for a more prominent run action
- Refreshes automatically when `package.json` files are created, changed, or deleted
- Supports rerunning the last script from the view title
- Renders `//` comment keys as non-runnable section headers, preserving your groupings
- Configurable sort order — original, alphabetical, or alphabetical within each section
- Pin any script into a collapsible **Pinned** group at the top with a hover icon or by dragging; filter the list to pinned scripts only
- Drag scripts and groups into your own order, remembered per workspace ([details](#drag-to-reorder))
- Collapsed groups stay collapsed across rebuilds and restarts
- Shows what each script does, from a `"scripts-info"` block in `package.json` — beside the name and on hover ([details](#script-info))
- Marks scripts that hit production (red cloud) or a local server (green computer), from an `env` field in `"scripts-info"`
- Shows which scripts are running (spinning icon) and how the last run ended — ✓ / ✗ and how long it took ([details](#run-status))
- Groups scripts by workflow stage — develop, check, release… — from a `stage` field, each group with an icon matching its name ([details](#group-by-stage))
- Asks before running scripts you mark with `confirm`, such as a release ([details](#confirm-before-running))
- Right-click a script to **Run with Arguments…** or **Open in package.json**
- Checks `"scripts-info"` against your scripts in the Problems panel, with a quick fix for missing entries ([details](#checking-scripts-info))

## Install

### From a VSIX

1. Open VS Code.
2. Open the Extensions view.
3. Open the `...` menu.
4. Select `Install from VSIX...`.
5. Choose the packaged `.vsix` file.

## Use

1. Open a folder or workspace that contains at least one `package.json`.
2. Click the `Run` icon in the Activity Bar.
3. Expand a package if needed.
4. Click a script to execute it in the integrated terminal.

Use the title bar actions in the view to:

- refresh script discovery
- rerun the last executed script (with the same arguments, asking again if it's marked `confirm`)
- switch between showing commands and script info
- switch between grouping by section and by stage
- show only pinned scripts (filter icon), and back to all scripts
- reset the order you set by dragging (**…** menu → **Reset Script Order**)

Right-click a script to:

- **Run with Arguments…** — type extra arguments (e.g. `--watch` or a test file); they're remembered per script for next time. For npm the extension adds the `--` npm needs; pnpm, yarn and bun get them as typed.
- **Open in package.json** — jump to the script's line.
- pin, unpin, reorder pins, or set its icon color.

## Settings

### `runSidebar.scope`

- `root`: show scripts only from the first workspace folder root `package.json`
- `all`: scan all workspace folders and show every discovered package

### `runSidebar.showPlayIcon`

- `true`: show a play icon next to each script
- `false`: show scripts without the icon

### `runSidebar.scriptUiMode`

- `default`: keep the current compact script list
- `button`: show scripts in a more action-oriented `Run <script>` layout

### `runSidebar.packageManager`

- `auto`: detect from lockfiles
- `npm`, `pnpm`, `yarn`, `bun`: force a specific package manager

### `runSidebar.terminalMode`

- `new`: create a new terminal per run
- `reuse`: reuse one shared terminal named `Run`

### `runSidebar.focusTerminal`

- `true`: focus the terminal after starting a script
- `false`: keep focus in the sidebar

### `runSidebar.scriptDescription`

What to show in grey beside each script name. See [Script info](#script-info).

- `command` (default): the script's command.
- `info`: the script's info from `"scripts-info"`. A script with no info shows its command instead, so nothing is ever blank.

Either way, hovering a script shows both its info and its command. The button in the Scripts view title bar switches between the two without opening Settings.

### `runSidebar.showEnvIcons`

- `true` (default): scripts whose `env` mentions prod or local get a red cloud or green computer icon. See [Environment icons](#script-info).
- `false`: they keep the play icon.

### `runSidebar.groupBy`

- `section` (default): group scripts under `//` section headers.
- `stage`: group scripts by their `stage` field. See [Group by stage](#group-by-stage).

### `runSidebar.showRunStatus`

- `true` (default): spinning icon while a script runs, then ✓ / ✗ and the time taken. See [Run status](#run-status).
- `false`: no status.

### `runSidebar.validateScriptsInfo`

- `true` (default): report `"scripts-info"` problems in the Problems panel. See [Checking scripts-info](#checking-scripts-info).
- `false`: no checks.

### `runSidebar.sortOrder`

- `original`: show scripts in the order they appear in `package.json` (default)
- `alphabetical`: sort all scripts A→Z
- `alphabeticalGrouped`: sort scripts A→Z within each `//` section, keeping section order intact

### Pinning scripts

Hover any script to reveal a pin icon on the right. Click it to move the script into the **Pinned** group at the top of the list. Pinned scripts show a thumbtack icon and persist across restarts.

**Pinned** is a collapsible group like the section and stage groups: click its arrow to fold it away. It stays at the top whichever way the list is grouped.

### Drag to reorder

Drag scripts and groups to put them in the order you want. The order is remembered per workspace, including after VS Code restarts; `package.json` is never changed.

| Drag | Result |
|---|---|
| a script onto another script in the same group | it takes that script's place |
| a group onto another group | it takes that group's place (works for `//` sections and stages, each remembered separately) |
| a script above all groups onto a group, or the other way round | they swap places at the top level |
| a script onto **Pinned** or onto a pinned script | it's pinned, at that spot |
| a pinned script onto another pinned script | Pinned is reordered |
| a pinned script onto anything outside Pinned | it's unpinned |

A script can't be dragged into a *different* section or stage group: which group it's in comes from `package.json` (its `//` section or its `stage` field), so edit that to move it. The status bar says so if you try. Scripts can't move between packages either.

New scripts appear after the ones you've arranged. To go back to `package.json`'s order, choose **Reset Script Order** from the **…** menu in the Scripts view title bar (pins are kept).

### Folded groups stay folded

Groups and packages you collapse stay collapsed when the list is rebuilt — switching between section and stage grouping, turning the pinned filter on or off, or editing `package.json` — and after VS Code restarts. **Pinned** shares one state across both groupings; section groups and stage groups each remember their own. Stored per workspace.

To reorder pinned scripts, drag them, or right-click a pinned script and choose **Move Up** or **Move Down**. Dragging a script onto **Pinned** pins it; dragging a pinned script out unpins it. To unpin, hover the script and click the thumbtack icon, or use the right-click menu.

### Show only pinned

Click the filter icon in the Scripts view title bar to show just your pinned scripts, in their pinned order; click it again (filled icon) to show everything. Pinning, unpinning and reordering work the same while filtered.

- With several packages (`runSidebar.scope`: `all`), only packages that have pinned scripts are listed.
- The filter is remembered per workspace. It isn't a setting, so it doesn't follow you to other projects.

### Section headers

Script keys that start with `//` are treated as non-runnable section headers. They display as label rows with no play button. Use them in your `package.json` to visually group related scripts:

```json
"scripts": {
  "//--- Build ---": "",
  "build": "tsc",
  "build:watch": "tsc --watch",
  "//--- Test ---": "",
  "test": "vitest"
}
```

### Script info

`package.json` has no comments, so there's nowhere to say what a script does. Add a `"scripts-info"` object next to `"scripts"`, keyed by script name, and the sidebar shows each script's info:

```json
"scripts": {
  "dev": "vite",
  "test": "vitest run",
  "release": "bash ./scripts/release.sh"
},
"scripts-info": {
  "dev": "Run the app with hot reload.",
  "test": "Run the unit tests once.",
  "release": "Publish to all users: bump version, build, upload."
}
```

npm, pnpm, yarn and bun all ignore unknown top-level keys, so this changes nothing about how the scripts run.

**Extra details: the object form**

An entry can also be an object. `description` is the main text; every other field becomes its own labelled line in the tooltip, so details like which server a script talks to don't clutter the description:

```json
"scripts-info": {
  "lint": "Check code style with ESLint.",
  "dev": {
    "description": "Run the app with hot reload.",
    "env": "local server"
  },
  "release": {
    "description": "Publish to all users: bump version, build, upload.",
    "env": "prod server",
    "warning": "Ships to every user"
  }
}
```

Hovering `release` then shows:

> **Info:** Publish to all users: bump version, build, upload.
>
> **Env:** prod server
>
> **Warning:** Ships to every user
>
> **Script:** `release` · **Command:** `bash ./scripts/release.sh` · **Package:** …

- Field names become labels: `env` → **Env**, `requiresDocker` or `requires_docker` → **Requires docker**. Use any names you like.
- Fields appear in the order you write them.
- Text, number and `true`/`false` values are shown; nested objects and arrays are ignored.
- Strings and objects can be mixed freely in one `"scripts-info"`.

**Environment icons**

If an entry has an `env` (or `environment`) field, the extension looks for known words in it and marks the script so you can tell at a glance which server it talks to:

| `env` contains | Icon | Color |
|---|---|---|
| `prod`, `production` or `live` | cloud | red |
| `local`, `localhost`, `dev` or `development` | computer | green |
| anything else | the normal play icon | |

- Words match whole: `"prod server"`, `"Production API"` and `"localhost:3200"` match; `"devops"` doesn't.
- The icon replaces the play icon on that row, and shows on the **Env:** line of the tooltip.
- Pinned scripts keep the pin icon.
- A color you set on the script, or `runSidebar.accentColor`, overrides the red/green.
- Turn it off with `runSidebar.showEnvIcons`.

**Where it shows**

| | `runSidebar.scriptDescription: "command"` (default) | `"info"` |
|---|---|---|
| Beside the script name | the command | the `description`, or the command if the script has none |
| Hover tooltip | **Info**, one line per extra field (e.g. **Env**), then Script, Command, Package | the same |

**Switching:** click the button in the Scripts view title bar. While commands are shown it is an info icon (**Show Script Info**); while info is shown it is a terminal icon (**Show Script Commands**). It changes `runSidebar.scriptDescription` wherever that setting is already set (folder, workspace or user; user settings if it's set nowhere), so the button and the Settings page always agree. Both are also in the Command Palette as **Run: Show Script Info** and **Run: Show Script Commands**.

In `button` UI mode the text beside the name is shortened to one line; the tooltip always has the full text.

**Details**

- **Fallback:** a script missing from `"scripts-info"`, or an object entry without a `description`, shows its command beside the name. Entries whose key isn't a script name are ignored.
- **Monorepos:** each `package.json` has its own `"scripts-info"`; with `runSidebar.scope` set to `all`, every package shows its own.
- **`ntl` compatibility:** descriptions in `"ntl": { "descriptions": { ... } }` (the format used by the `ntl` CLI) are read too. If both describe the same script, `"scripts-info"` wins.
- **Terminal tools:** other tools that read `"scripts-info"` may expect plain strings only; if you use one, keep the entries it needs as strings.
- **Live updates:** editing `package.json` refreshes the sidebar immediately, like any script change.
- **Keep it short.** The sidebar is narrow: about 50 characters fits on one line. Longer text is cut off beside the name but shown in full on hover.
- **Section headers** (`//` keys) don't take info.

### Group by stage

Give each script a `stage` in `"scripts-info"` — the step of your workflow it belongs to — and click the **Group by Stage** button (layers icon) in the Scripts view title bar:

```json
"scripts-info": {
  "dev":     { "description": "Run the app with hot reload.", "stage": "develop" },
  "test":    { "description": "Run the unit tests once.", "stage": "check" },
  "build":   { "description": "Production build.", "stage": "package" },
  "release": { "description": "Publish to all users.", "stage": "release" }
}
```

- Stage names are yours; common ones are `develop`, `check`, `package`, `release`, `maintain`.
- Groups appear in the order their stage first appears in `"scripts"`, so reorder `"scripts"` to reorder the groups. Names are shown capitalized; `Develop` and `develop` are the same stage.
- Scripts without a stage go in a last group, **Other**.
- `//` section headers aren't shown in this view; click **Group by Section** (list icon) to go back to them.
- Pinned scripts stay at the top, in their own **Pinned** group, in both views.
- The stage also shows as a **Stage:** line on hover.

Each stage group gets an icon from its name:

| Stage name | Icon |
|---|---|
| `dev`, `develop`, `development`, `start`, `serve`, `run` | flame |
| `check`, `test`, `testing`, `lint`, `verify`, `qa`, `quality` | beaker |
| `build`, `package`, `packaging`, `bundle`, `compile` | package |
| `release`, `publish`, `deploy`, `deployment`, `ship` | rocket |
| `maintain`, `maintenance`, `housekeeping`, `tools`, `utils`, `setup`, `misc` | tools |
| `docs`, `documentation` | book |
| `db`, `database`, `data`, `migrate`, `migrations` | database |
| anything else | layers |

Names match whole and ignore case, so `Release` gets the rocket and `prerelease` gets the generic icon. **Other** has its own icon, and `//` section groups share a list icon, so every group row lines up.

### Confirm before running

Scripts run as soon as you click them. For scripts where a slip is costly, add `confirm`:

```json
"release": {
  "description": "Publish to all users.",
  "confirm": "Publishes a new version to every user."
}
```

- `"confirm": true` asks **Run "release"?** with the command shown.
- A string is shown as the warning above the command.
- `false` or leaving it out: no question.
- Applies to clicking the script, **Rerun Last Script** and **Run with Arguments…**.
- The tooltip says **Asks before running** for these scripts.

### Run status

While a script runs, its icon spins. When it ends, the grey text starts with the result and how long it took:

- `✓ 3m 44s` — exited with code 0
- `✗ 12s` — failed (hover shows the exit code)
- `■ 0.8s` — stopped: interrupted, the terminal was closed, or another script took over the shared terminal

Hover shows the details, e.g. **Last run:** succeeded in 3m 44s (started 14:02). The status lasts until the next run or until VS Code restarts.

This uses VS Code's terminal shell integration (VS Code 1.93+, with bash, zsh, fish or PowerShell, which VS Code sets up automatically). If a terminal doesn't have it within 3 seconds, the script still runs, just without status, and later runs stop waiting for it. Turn it off with `runSidebar.showRunStatus`.

### Checking scripts-info

In a `package.json` that has a `"scripts-info"` block, open the file and the Problems panel shows:

- a **warning** on an entry for a script that doesn't exist (renamed or removed)
- a **note** on each script without info, with a quick fix (lightbulb, or `Cmd+.` / `Ctrl+.`) that adds an empty entry to fill in

`//` section headers are never expected to have info, and projects without `"scripts-info"` see nothing. Turn it off with `runSidebar.validateScriptsInfo`.

### Reserved fields

In an object entry, `description`, `stage` and `confirm` have the meanings above; `env` also drives the environment icons. Every other field is shown as a labelled line on hover.

## Behavior Notes

- In `root` mode, the terminal title uses the script name.
- In `all` mode, the terminal title uses `package: script`.
- In `reuse` mode, the extension recreates the shared terminal when you switch to a different package directory so the shell starts in the correct working directory.
- Automatic package-manager detection walks up from the selected package directory to the workspace root and looks for known lockfiles.

## Known Limitations

- The extension only reads `package.json` scripts. It does not parse custom task runners or shell aliases.
- `root` mode only uses the first workspace folder.
- Untrusted workspaces and virtual workspaces are not supported.

## Development

```bash
npm install
npm run compile
```

To package a local release:

```bash
npm run package:vsix
```

## Automated Publishing

This repository includes a GitHub Actions workflow at `.github/workflows/publish.yml`.
It runs when `package.json`, `package-lock.json`, or the workflow file itself changes on `main` or `master`, and it can also be started manually from the Actions tab.
It publishes when the `version` in `package.json` differs from the version live on the Marketplace (checked with `vsce show`), so a version bump is published even when it isn't the newest of the commits in a push, and a re-run after a failed publish tries again.

Before it can publish, add a GitHub repository secret named `VSCE_PAT`.
The value must be a Visual Studio Marketplace personal access token with Marketplace manage access.

Release flow:

1. Update the `version` in `package.json`.
2. Commit the release.
3. Push the commit to GitHub.

Example:

```bash
git add .
git commit -m "Release 0.2.3"
git push origin main
```

## License

MIT
