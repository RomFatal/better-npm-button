import * as vscode from "vscode";

export type RunScope = "root" | "all";
export type ScriptUiMode = "default" | "button";
export type PackageManager = "auto" | "npm" | "pnpm" | "yarn" | "bun";
export type TerminalMode = "reuse" | "new";
export type SortOrder = "original" | "alphabetical" | "alphabeticalGrouped";
export type ScriptDescription = "info" | "command";
export type ScriptColor = "default" | "green" | "blue" | "red" | "yellow" | "cyan" | "magenta";

const SECTION = "runSidebar";

export interface RunSidebarConfig {
  scope: RunScope;
  showPlayIcon: boolean;
  scriptUiMode: ScriptUiMode;
  packageManager: PackageManager;
  terminalMode: TerminalMode;
  focusTerminal: boolean;
  sortOrder: SortOrder;
  accentColor: ScriptColor;
  scriptDescription: ScriptDescription;
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
    sortOrder: config.get<SortOrder>("sortOrder", "original"),
    accentColor: config.get<ScriptColor>("accentColor", "default"),
    scriptDescription: config.get<ScriptDescription>("scriptDescription", "command")
  };
}

/**
 * Switch what's shown beside script names. Writes to wherever the setting is
 * already set (folder, workspace, or user), so the sidebar button and the
 * Settings UI never disagree; a setting set nowhere goes to user settings.
 */
export async function setScriptDescription(value: ScriptDescription): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  const current = config.inspect<ScriptDescription>("scriptDescription");
  const target =
    current?.workspaceFolderValue !== undefined
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : current?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
  await config.update("scriptDescription", value, target);
}

export function isRunSidebarConfigChange(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(SECTION);
}
