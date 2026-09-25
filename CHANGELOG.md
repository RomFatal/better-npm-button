# Change Log

## 0.3.0

- **Run status:** a spinning icon while a script runs, then ✓ / ✗ / ■ and how long it took beside its name, with details on hover (uses terminal shell integration, VS Code 1.93+). Setting: `runSidebar.showRunStatus`
- **Group by stage:** a `stage` field in `"scripts-info"` and a title-bar toggle between grouping by `//` section and by stage. Setting: `runSidebar.groupBy`
- **Confirm before running:** `"confirm": true` or a warning message in `"scripts-info"`; applies to click, Rerun Last and Run with Arguments. Off unless you add it
- **Run with Arguments…** in the script's right-click menu, remembering the last arguments per script
- **Open in package.json** in the script's right-click menu
- **Show only pinned:** a title-bar filter that shows just your pinned scripts (and only packages that have some); remembered per workspace
- Toggle buttons explain how to recover if VS Code hasn't loaded a new version's settings yet, instead of failing with VS Code's raw error
- **Checking scripts-info:** Problems-panel warnings for info about missing scripts and notes for scripts without info, with a quick fix. Setting: `runSidebar.validateScriptsInfo`

## 0.2.18

- Environment icons: a script whose `"scripts-info"` entry has an `env` field mentioning prod / production / live gets a red cloud icon; local / localhost / dev / development gets a green computer icon. The icon replaces the play icon on the row and appears on the tooltip's **Env:** line
- Pinned scripts keep the pin; per-script and accent colors override the red/green
- Added `runSidebar.showEnvIcons` setting (default on)

## 0.2.17

- `"scripts-info"` entries can be objects: `description` plus any extra fields (e.g. `"env": "prod server"`), each shown as its own labelled line in the hover tooltip (**Env:**). Plain string entries work as before
- Field names become readable labels (`requiresDocker` → **Requires docker**); nested values are ignored
- README: object form, labels, fallback rules

## 0.2.16

- `runSidebar.scriptDescription` now defaults to `command`: the sidebar shows commands unless you switch to info
- New title-bar button in the Scripts view switches between commands and info (also **Run: Show Script Info** / **Run: Show Script Commands** in the Command Palette); it updates the setting in whichever scope it's already set
- Hover tooltip labels the script's info (**Info:**) like the other lines
- README: full Script info section — where it shows for each setting, fallback, monorepos, `ntl` compatibility, length tips

## 0.2.15

- Shows what each script does: descriptions come from a `"scripts-info"` object in `package.json` (keyed by script name), with `ntl.descriptions` also supported
- The description replaces the command beside the script name and leads the hover tooltip; scripts without one still show their command
- Added `runSidebar.scriptDescription` setting — `info` (default) or `command` to always show the command

## 0.2.14

- Removed label text coloring — color applies to the icon only, so selected/hovered items stay white as expected

## 0.2.13

- Section headers (// comment keys) are now collapsible groups — click the arrow to collapse or expand all scripts in a section
- Scripts that belong to a section become children of it; scripts before the first section remain at the top level
- Expanded by default; VS Code remembers collapse state per section

## 0.2.12

- Script label text is now colored to match the icon — individual and global colors apply to both

## 0.2.11

- Added `runSidebar.accentColor` setting — global icon color for all scripts (green, blue, red, yellow, cyan, magenta, or default)
- Added per-script color override — hover any script and click `$(symbol-color)` to pick an individual color
- Individual color takes priority over the global setting (CSS-like specificity); pick "Default" in the picker to clear it
- Individual colors persist in workspace state alongside pin state
- Updated README with pinning docs, section header docs, and sort order docs

## 0.2.10

- Fixed crash when clicking pin — context menu commands receive the tree item, not the command arguments object, so ScriptItem now exposes packageFile and scriptName as public fields

## 0.2.9

- Move-up / move-down arrows removed from inline hover area — now accessible via right-click only
- Hover on a pinned script shows only the unpin icon (cleaner row)

## 0.2.8

- Added move-up / move-down arrows on pinned scripts so you can reorder the Pinned section
- Arrows are position-aware: up arrow only shows when not already first, down arrow only when not already last
- Order persists in workspace state alongside pin state

## 0.2.7

- Added script pinning — hover a script to see the pin icon, click to float it to a **Pinned** section at the top of the list
- Pinned scripts persist across restarts via workspace state
- Pinned scripts show a `$(pinned)` icon and can be unpinned via hover icon or right-click menu
- Pin / Unpin also available in the right-click context menu (not only on hover)

## 0.2.6

- Render `//` script keys as non-runnable section headers instead of clickable scripts
- Preserve `package.json` insertion order by default instead of sorting alphabetically
- Added a `runSidebar.sortOrder` setting with `original`, `alphabetical`, and `alphabeticalGrouped` modes

## 0.2.4

- Added a README screenshot preview for the `Run` view
- Packaged the screenshot asset with the extension documentation

## 0.2.2

- Added a new `runSidebar.scriptUiMode` setting with a `button` option for a more action-oriented script row layout
- Kept the existing compact script list as the default UI

## 0.2.1

- Replaced the script item style dropdown with a simpler `runSidebar.showPlayIcon` checkbox setting
- Kept compatibility with the legacy `runSidebar.itemStyle` value when the new setting is not set

## 0.1.0

- Renamed the extension to Better Npm Button
- Rebuilt the extension as a modern TypeScript VS Code extension
- Added a dedicated `Run` Activity Bar view
- Added root or all package discovery modes
- Added theme-aware icon mode and plain text mode
- Added automatic package manager detection and terminal execution
- Hardened shared terminal reuse so switching packages recreates the terminal in the correct working directory
- Added extension icon, license file, and packaging cleanup for VSIX releases
- Expanded the README with install, usage, settings, and limitation docs
