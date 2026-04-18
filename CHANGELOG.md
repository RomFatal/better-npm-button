# Change Log

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
