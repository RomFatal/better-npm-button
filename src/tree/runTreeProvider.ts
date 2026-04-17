import * as vscode from "vscode";
import { ItemStyle, RunScope, getConfig } from "../config";
import { PackageScriptFile } from "../services/packageDiscoveryService";

export interface ScriptRunItem {
  packageFile: PackageScriptFile;
  scriptName: string;
}

export class RunTreeProvider implements vscode.TreeDataProvider<RunItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<RunItem | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(
    private readonly loadPackages: (scope: RunScope) => Promise<PackageScriptFile[]>
  ) {}

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: RunItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: RunItem): Promise<RunItem[]> {
    const config = getConfig();

    if (!element) {
      const packages = await this.loadPackages(config.scope);
      return this.getRootItems(packages, config.scope, config.itemStyle);
    }

    if (element instanceof PackageItem) {
      return this.getScriptItems(element.packageFile, config.itemStyle);
    }

    return [];
  }

  private getRootItems(
    packages: PackageScriptFile[],
    scope: RunScope,
    itemStyle: ItemStyle
  ): RunItem[] {
    if ((vscode.workspace.workspaceFolders ?? []).length === 0) {
      return [new MessageItem("Open a workspace folder to show scripts.")];
    }

    if (scope === "root") {
      const packageFile = packages[0];
      if (!packageFile) {
        return [new MessageItem("No root package.json found in the first workspace folder.")];
      }

      return this.getScriptItems(packageFile, itemStyle, "No scripts found in the root package.json.");
    }

    if (packages.length === 0) {
      return [new MessageItem("No package.json files found in this workspace.")];
    }

    return packages.map((packageFile) => new PackageItem(packageFile));
  }

  private getScriptItems(
    packageFile: PackageScriptFile,
    itemStyle: ItemStyle,
    emptyMessage = "No scripts found."
  ): RunItem[] {
    const scriptNames = Object.keys(packageFile.scripts).sort((left, right) => left.localeCompare(right));
    if (scriptNames.length === 0) {
      return [new MessageItem(emptyMessage)];
    }

    return scriptNames.map((scriptName) => new ScriptItem(packageFile, scriptName, itemStyle));
  }
}

export abstract class RunItem extends vscode.TreeItem {}

class PackageItem extends RunItem {
  public constructor(public readonly packageFile: PackageScriptFile) {
    super(packageFile.displayName, vscode.TreeItemCollapsibleState.Expanded);

    this.iconPath = new vscode.ThemeIcon("package");
    this.description = packageFile.relativeDirectory === "." ? "root" : packageFile.workspaceFolder.name;
    this.tooltip = new vscode.MarkdownString(
      [
        `**Package:** ${packageFile.packageName ?? "Unnamed package"}`,
        `**Path:** ${packageFile.packageJsonUri.fsPath}`
      ].join("\n\n")
    );
  }
}

class ScriptItem extends RunItem {
  public constructor(
    packageFile: PackageScriptFile,
    scriptName: string,
    itemStyle: ItemStyle
  ) {
    super(scriptName, vscode.TreeItemCollapsibleState.None);

    const scriptValue = packageFile.scripts[scriptName];

    this.command = {
      command: "runSidebar.runScript",
      title: "Run Script",
      arguments: [
        {
          packageFile,
          scriptName
        } satisfies ScriptRunItem
      ]
    };
    this.description = scriptValue;
    this.tooltip = new vscode.MarkdownString(
      [
        `**Script:** \`${scriptName}\``,
        `**Command:** \`${scriptValue}\``,
        `**Package:** ${packageFile.displayName}`
      ].join("\n\n")
    );
    this.contextValue = "script";

    if (itemStyle === "icon") {
      this.iconPath = new vscode.ThemeIcon("play-circle");
    }
  }
}

class MessageItem extends RunItem {
  public constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.iconPath = new vscode.ThemeIcon("info");
  }
}
