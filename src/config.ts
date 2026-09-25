import * as vscode from "vscode";

export type RunScope = "root" | "all";
export type ScriptUiMode = "default" | "button";
export type PackageManager = "auto" | "npm" | "pnpm" | "yarn" | "bun";
export type TerminalMode = "reuse" | "new";
export type SortOrder = "original" | "alphabetical" | "alphabeticalGrouped";
export type ScriptDescription = "info" | "command";
export type GroupBy = "section" | "stage";
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
  showEnvIcons: boolean;
  groupBy: GroupBy;
  showRunStatus: boolean;
  validateScriptsInfo: boolean;
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
    scriptDescription: config.get<ScriptDescription>("scriptDescription", "command"),
    showEnvIcons: config.get<boolean>("showEnvIcons", true),
    groupBy: config.get<GroupBy>("groupBy", "section"),
    showRunStatus: config.get<boolean>("showRunStatus", true),
    validateScriptsInfo: config.get<boolean>("validateScriptsInfo", true)
  };
}

/**
 * Switch what's shown beside script names. Writes to wherever the setting is
 * already set (folder, workspace, or user), so the sidebar button and the
 * Settings UI never disagree; a setting set nowhere goes to user settings.
 */
export async function setScriptDescription(value: ScriptDescription): Promise<void> {
  await updateInCurrentScope("scriptDescription", value);
}

/** Same, for the Group by Section / Group by Stage title-bar toggle. */
export async function setGroupBy(value: GroupBy): Promise<void> {
  await updateInCurrentScope("groupBy", value);
}

async function updateInCurrentScope(key: string, value: unknown): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  const current = config.inspect(key);
  const target =
    current?.workspaceFolderValue !== undefined
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : current?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
  try {
    await config.update(key, value, target);
  } catch {
    // Seen right after an in-place update: the window still has the old
    // version's list of settings while running the new code.
    void vscode.window.showErrorMessage(
      `Couldn't change runSidebar.${key}: VS Code hasn't loaded this version's settings yet. Quit and reopen VS Code, then try again.`
    );
  }
}

export function isRunSidebarConfigChange(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(SECTION);
}
