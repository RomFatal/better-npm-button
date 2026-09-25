import * as vscode from "vscode";
import { ScriptColor, getConfig, isRunSidebarConfigChange, setGroupBy, setScriptDescription } from "./config";
import { PackageDiscoveryService } from "./services/packageDiscoveryService";
import { PackageManagerService } from "./services/packageManagerService";
import { PinnedScriptsService } from "./services/pinnedScriptsService";
import { ScriptColorService } from "./services/scriptColorService";
import { locatePackageJson } from "./services/packageJsonLocator";
import { RunStateService } from "./services/runStateService";
import { ScriptsInfoValidator, isPackageJson } from "./services/scriptsInfoValidator";
import { ScriptRunRequest, TerminalService } from "./services/terminalService";
import { RunItem, RunTreeProvider, ScriptItem, ScriptRunItem } from "./tree/runTreeProvider";
import { CollapseStateService } from "./services/collapseStateService";
import { OrderService } from "./services/orderService";
import { ScriptsDragAndDrop } from "./tree/dragAndDrop";

export function activate(context: vscode.ExtensionContext): void {
  const packageDiscoveryService = new PackageDiscoveryService();
  const packageManagerService = new PackageManagerService();
  const pinnedService = new PinnedScriptsService(context.workspaceState);
  const colorService = new ScriptColorService(context.workspaceState);
  const runState = new RunStateService();
  const terminalService = new TerminalService(runState);
  const validator = new ScriptsInfoValidator();
  const collapseStore = new CollapseStateService(context.workspaceState);
  const orderService = new OrderService(context.workspaceState);
  const treeProvider = new RunTreeProvider(
    (scope) => packageDiscoveryService.listPackages(scope),
    pinnedService,
    colorService,
    runState,
    collapseStore,
    orderService
  );

  // The last script run from the sidebar, so Rerun Last goes through the
  // same confirm step with the same arguments.
  let lastRun: { item: ScriptRunItem; args?: string } | undefined;

  const runItem = async (item: ScriptRunItem, args?: string): Promise<void> => {
    if (!(await confirmIfAsked(item))) {
      return;
    }
    const request = await buildRunRequest(item, packageManagerService);
    if (!request) {
      void vscode.window.showWarningMessage("Could not resolve the selected script.");
      return;
    }
    lastRun = { item, args };
    await terminalService.run({ ...request, args });
  };

  context.subscriptions.push(terminalService, runState, validator);
  context.subscriptions.push(runState.onDidChange(() => treeProvider.refresh()));
  // createTreeView (not registerTreeDataProvider) to hear collapse/expand,
  // which is saved per workspace and read back when the tree is rebuilt.
  const treeView = vscode.window.createTreeView("runSidebar.scripts", {
    treeDataProvider: treeProvider,
    dragAndDropController: new ScriptsDragAndDrop(orderService, pinnedService, () => treeProvider.refresh())
  });
  const rememberCollapsed = (element: RunItem, collapsed: boolean): void => {
    if (element.id) {
      void collapseStore.set(element.id, collapsed);
    }
  };
  context.subscriptions.push(
    treeView,
    treeView.onDidCollapseElement((event) => rememberCollapsed(event.element, true)),
    treeView.onDidExpandElement((event) => rememberCollapsed(event.element, false))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.refresh", () => {
      treeProvider.refresh();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.rerunLast", async () => {
      if (!lastRun) {
        void vscode.window.showInformationMessage("No script has been run yet.");
        return;
      }
      await runItem(lastRun.item, lastRun.args);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.runScript", (item: ScriptRunItem) => runItem(item))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.runWithArgs", async (item: ScriptItem) => {
      const memoryKey = `runSidebar.args:${item.packageFile.packageJsonUri.fsPath}:${item.scriptName}`;
      const args = await vscode.window.showInputBox({
        title: `Run "${item.scriptName}" with arguments`,
        prompt: "Passed to the script as typed, e.g. --watch or a test file name",
        placeHolder: "--watch",
        value: context.workspaceState.get<string>(memoryKey, "")
      });
      if (args === undefined) {
        return;
      }
      await context.workspaceState.update(memoryKey, args);
      await runItem({ packageFile: item.packageFile, scriptName: item.scriptName }, args);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.openInPackageJson", async (item: ScriptItem) => {
      const document = await vscode.workspace.openTextDocument(item.packageFile.packageJsonUri);
      const key = locatePackageJson(document.getText())
        .objects.get("scripts")
        ?.keys.find((entry) => entry.name === item.scriptName);
      const editor = await vscode.window.showTextDocument(document);
      if (key) {
        const range = new vscode.Range(document.positionAt(key.start), document.positionAt(key.end));
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      }
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
  // Sidebar title-bar toggle between each script's command and its
  // "scripts-info" text. Only one of the two buttons shows at a time.
  // Show Only Pinned: a per-workspace filter, not a setting. The context key
  // decides which of the two title-bar buttons shows.
  const PINNED_ONLY_KEY = "runSidebar.pinnedOnly";
  const setPinnedOnly = async (value: boolean): Promise<void> => {
    treeProvider.pinnedOnly = value;
    await context.workspaceState.update(PINNED_ONLY_KEY, value);
    await vscode.commands.executeCommand("setContext", PINNED_ONLY_KEY, value);
    treeProvider.refresh();
  };
  void setPinnedOnly(context.workspaceState.get<boolean>(PINNED_ONLY_KEY, false));
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.showPinnedOnly", () => setPinnedOnly(true)),
    vscode.commands.registerCommand("runSidebar.showAllScripts", () => setPinnedOnly(false))
  );
  // Puts the scripts-info writing guide (docs/SCRIPTS_INFO_AI_GUIDE.md,
  // shipped with the extension) on the clipboard, to paste into an AI chat.
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.copyAiInstructions", async () => {
      const guide = vscode.Uri.joinPath(context.extensionUri, "docs", "SCRIPTS_INFO_AI_GUIDE.md");
      const text = Buffer.from(await vscode.workspace.fs.readFile(guide)).toString("utf8");
      await vscode.env.clipboard.writeText(text);
      const choice = await vscode.window.showInformationMessage(
        'Copied the scripts-info instructions. Paste them into your AI chat and ask it to "add scripts-info to this project".',
        "Open Guide"
      );
      if (choice === "Open Guide") {
        await vscode.commands.executeCommand("markdown.showPreview", guide);
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.resetOrder", async () => {
      const answer = await vscode.window.showWarningMessage(
        "Reset the order of scripts and groups to package.json's order?",
        { modal: true, detail: "Only the order you set by dragging is cleared. Pinned scripts stay pinned." },
        "Reset"
      );
      if (answer === "Reset") {
        await orderService.clearAll();
        treeProvider.refresh();
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.groupByStage", () => setGroupBy("stage")),
    vscode.commands.registerCommand("runSidebar.groupBySection", () => setGroupBy("section"))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("runSidebar.showScriptInfo", () => setScriptDescription("info")),
    vscode.commands.registerCommand("runSidebar.showScriptCommands", () =>
      setScriptDescription("command")
    )
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (isRunSidebarConfigChange(event)) {
        treeProvider.refresh();
        validateOpenDocuments();
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      treeProvider.refresh();
    })
  );

  // scripts-info checks in the Problems panel, for open package.json files.
  function validateOpenDocuments(): void {
    const enabled = getConfig().validateScriptsInfo;
    for (const document of vscode.workspace.textDocuments) {
      validator.validate(document, enabled);
    }
  }
  validateOpenDocuments();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { pattern: "**/package.json" },
      validator,
      { providedCodeActionKinds: ScriptsInfoValidator.providedCodeActionKinds }
    ),
    vscode.workspace.onDidOpenTextDocument((document) =>
      validator.validate(document, getConfig().validateScriptsInfo)
    ),
    vscode.workspace.onDidChangeTextDocument((event) =>
      validator.validate(event.document, getConfig().validateScriptsInfo)
    ),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (isPackageJson(document.uri)) {
        validator.clear(document.uri);
      }
    })
  );
}

export function deactivate(): void {}

/**
 * Scripts marked "confirm" in scripts-info ask first: `true` asks
 * "Run …?", a string is shown as the warning. Everything else runs at once.
 */
async function confirmIfAsked(item: ScriptRunItem): Promise<boolean> {
  const confirm = item.packageFile.scriptInfo[item.scriptName]?.confirm;
  if (!confirm) {
    return true;
  }
  const command = item.packageFile.scripts[item.scriptName];
  const answer = await vscode.window.showWarningMessage(
    `Run "${item.scriptName}"?`,
    {
      modal: true,
      detail: `${typeof confirm === "string" ? `${confirm}\n\n` : ""}Command: ${command}`
    },
    "Run"
  );
  return answer === "Run";
}

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
