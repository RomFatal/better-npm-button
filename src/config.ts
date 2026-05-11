import * as vscode from "vscode";

export type RunScope = "root" | "all";
export type ScriptUiMode = "default" | "button";
export type PackageManager = "auto" | "npm" | "pnpm" | "yarn" | "bun";
export type TerminalMode = "reuse" | "new";
export type SortOrder = "original" | "alphabetical" | "alphabeticalGrouped";

const SECTION = "runSidebar";

export interface RunSidebarConfig {
  scope: RunScope;
  showPlayIcon: boolean;
  scriptUiMode: ScriptUiMode;
  packageManager: PackageManager;
  terminalMode: TerminalMode;
  focusTerminal: boolean;
  sortOrder: SortOrder;
}

export function getConfig(): RunSidebarConfig {
  const config = vscode.workspace.getConfiguration(SECTION);
  const showPlayIconSetting = config.inspect<boolean>("showPlayIcon");
  const hasExplicitShowPlayIcon =
    showPlayIconSetting?.workspaceFolderValue !== undefined ||
    showPlayIconSetting?.workspaceValue !== undefined ||
    showPlayIconSetting?.globalValue !== undefined;
  const legacyItemStyle = config.get<string>("itemStyle", "icon");

  return {
    scope: config.get<RunScope>("scope", "root"),
    showPlayIcon: hasExplicitShowPlayIcon
      ? config.get<boolean>("showPlayIcon", true)
      : legacyItemStyle === "icon",
    scriptUiMode: config.get<ScriptUiMode>("scriptUiMode", "default"),
    packageManager: config.get<PackageManager>("packageManager", "auto"),
    terminalMode: config.get<TerminalMode>("terminalMode", "new"),
    focusTerminal: config.get<boolean>("focusTerminal", true),
    sortOrder: config.get<SortOrder>("sortOrder", "original")
  };
}

export function isRunSidebarConfigChange(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(SECTION);
}
