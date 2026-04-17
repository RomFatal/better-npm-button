import * as vscode from "vscode";

export type RunScope = "root" | "all";
export type ItemStyle = "icon" | "text";
export type PackageManager = "auto" | "npm" | "pnpm" | "yarn" | "bun";
export type TerminalMode = "reuse" | "new";

const SECTION = "runSidebar";

export interface RunSidebarConfig {
  scope: RunScope;
  itemStyle: ItemStyle;
  packageManager: PackageManager;
  terminalMode: TerminalMode;
  focusTerminal: boolean;
}

export function getConfig(): RunSidebarConfig {
  const config = vscode.workspace.getConfiguration(SECTION);

  return {
    scope: config.get<RunScope>("scope", "root"),
    itemStyle: config.get<ItemStyle>("itemStyle", "icon"),
    packageManager: config.get<PackageManager>("packageManager", "auto"),
    terminalMode: config.get<TerminalMode>("terminalMode", "new"),
    focusTerminal: config.get<boolean>("focusTerminal", true)
  };
}

export function isRunSidebarConfigChange(event: vscode.ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(SECTION);
}
