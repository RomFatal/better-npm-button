import * as vscode from "vscode";
import { ScriptColor, getConfig, isRunSidebarConfigChange } from "./config";
import { PackageDiscoveryService } from "./services/packageDiscoveryService";
import { PackageManagerService } from "./services/packageManagerService";
import { PinnedScriptsService } from "./services/pinnedScriptsService";
import { ScriptColorService } from "./services/scriptColorService";
import { ScriptRunRequest, TerminalService } from "./services/terminalService";
import { RunTreeProvider, ScriptItem, ScriptRunItem } from "./tree/runTreeProvider";

export function activate(context: vscode.ExtensionContext): void {
  const packageDiscoveryService = new PackageDiscoveryService();
  const packageManagerService = new PackageManagerService();
  const pinnedService = new PinnedScriptsService(context.workspaceState);
  const colorService = new ScriptColorService(context.workspaceState);
  const terminalService = new TerminalService();
  const treeProvider = new RunTreeProvider(
    (scope) => packageDiscoveryService.listPackages(scope),
    pinnedService,
    colorService
  );

  context.subscriptions.push(terminalService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("runSidebar.scripts", treeProvider)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.refresh", () => {
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.rerunLast", () => {
      if (!terminalService.rerunLast()) {
        void vscode.window.showInformationMessage("No script has been run yet.");
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.runScript", async (item: ScriptRunItem) => {
      const request = await buildRunRequest(item, packageManagerService);
      if (!request) {
        void vscode.window.showWarningMessage("Could not resolve the selected script.");
        return;
      }

      terminalService.run(request);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.pinScript", (item: ScriptItem) => {
      pinnedService.pin(item.scriptName, item.packageFile.packageJsonUri.fsPath);
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.unpinScript", (item: ScriptItem) => {
      pinnedService.unpin(item.scriptName, item.packageFile.packageJsonUri.fsPath);
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.movePinnedUp", (item: ScriptItem) => {
      pinnedService.moveUp(item.scriptName, item.packageFile.packageJsonUri.fsPath);
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.movePinnedDown", (item: ScriptItem) => {
      pinnedService.moveDown(item.scriptName, item.packageFile.packageJsonUri.fsPath);
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.setScriptColor", async (item: ScriptItem) => {
      const packageUri = item.packageFile.packageJsonUri.fsPath;
      const current = colorService.getColor(item.scriptName, packageUri);

      const picked = await vscode.window.showQuickPick(buildColorPicks(current), {
        title: `Icon color for "${item.scriptName}"`,
        placeHolder: "Pick a color — individual overrides the global setting"
      });

      if (!picked) {
        return;
      }

      colorService.setColor(item.scriptName, packageUri, picked.color);
      treeProvider.refresh();
    })
  );

  const packageWatcher = vscode.workspace.createFileSystemWatcher("**/package.json");
  context.subscriptions.push(
    packageWatcher,
    packageWatcher.onDidCreate(() => treeProvider.refresh()),
    packageWatcher.onDidChange(() => treeProvider.refresh()),
    packageWatcher.onDidDelete(() => treeProvider.refresh())
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (isRunSidebarConfigChange(event)) {
        treeProvider.refresh();
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      treeProvider.refresh();
    })
  );
}

export function deactivate(): void {}

async function buildRunRequest(
  item: ScriptRunItem | undefined,
  packageManagerService: PackageManagerService
): Promise<ScriptRunRequest | undefined> {
  if (!item?.packageFile || !item.scriptName) {
    return undefined;
  }

  const packageManager = await packageManagerService.resolve(
    item.packageFile.packageDir,
    item.packageFile.workspaceFolder
  );

  return {
    packageDir: item.packageFile.packageDir,
    packageManager,
    scriptName: item.scriptName,
    terminalTitle: buildTerminalTitle(item)
  };
}

function buildTerminalTitle(item: ScriptRunItem): string {
  const config = getConfig();

  if (config.scope === "root") {
    return item.scriptName;
  }

  return `${getPackageLabel(item)}: ${item.scriptName}`;
}

interface ColorQuickPickItem extends vscode.QuickPickItem {
  color: ScriptColor;
}

function buildColorPicks(current: ScriptColor | undefined): ColorQuickPickItem[] {
  const entries: Array<{ color: ScriptColor; label: string }> = [
    { color: "green", label: "$(circle-filled) Green" },
    { color: "blue", label: "$(circle-filled) Blue" },
    { color: "red", label: "$(circle-filled) Red" },
    { color: "yellow", label: "$(circle-filled) Yellow" },
    { color: "cyan", label: "$(circle-filled) Cyan" },
    { color: "magenta", label: "$(circle-filled) Magenta" },
    { color: "default", label: "$(circle-outline) Default" }
  ];

  return entries.map(({ color, label }) => ({
    color,
    label,
    description:
      color === current
        ? "current"
        : color === "default"
          ? "clear individual override — use global setting"
          : undefined
  }));
}

function getPackageLabel(item: ScriptRunItem): string {
  if (item.packageFile.packageName?.trim()) {
    return item.packageFile.packageName.trim();
  }

  if (item.packageFile.relativeDirectory !== ".") {
    return item.packageFile.relativeDirectory;
  }

  return item.packageFile.workspaceFolder.name;
}
