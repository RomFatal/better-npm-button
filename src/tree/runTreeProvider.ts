import * as vscode from "vscode";
import { RunScope, ScriptUiMode, SortOrder, getConfig } from "../config";
import { PackageScriptFile } from "../services/packageDiscoveryService";
import { PinnedScriptsService } from "../services/pinnedScriptsService";

export interface ScriptRunItem {
  packageFile: PackageScriptFile;
  scriptName: string;
}

interface ScriptDisplayOptions {
  showPlayIcon: boolean;
  uiMode: ScriptUiMode;
  sortOrder: SortOrder;
}

export class RunTreeProvider implements vscode.TreeDataProvider<RunItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<RunItem | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(
    private readonly loadPackages: (scope: RunScope) => Promise<PackageScriptFile[]>,
    private readonly pinnedService: PinnedScriptsService
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
      return this.getRootItems(packages, config.scope, {
        showPlayIcon: config.showPlayIcon,
        uiMode: config.scriptUiMode,
        sortOrder: config.sortOrder
      });
    }

    if (element instanceof PackageItem) {
      return this.getScriptItems(element.packageFile, {
        showPlayIcon: config.showPlayIcon,
        uiMode: config.scriptUiMode,
        sortOrder: config.sortOrder
      });
    }

    return [];
  }

  private getRootItems(
    packages: PackageScriptFile[],
    scope: RunScope,
    displayOptions: ScriptDisplayOptions
  ): RunItem[] {
    if ((vscode.workspace.workspaceFolders ?? []).length === 0) {
      return [new MessageItem("Open a workspace folder to show scripts.")];
    }

    if (scope === "root") {
      const packageFile = packages[0];
      if (!packageFile) {
        return [new MessageItem("No root package.json found in the first workspace folder.")];
      }

      return this.getScriptItems(packageFile, displayOptions, "No scripts found in the root package.json.");
    }

    if (packages.length === 0) {
      return [new MessageItem("No package.json files found in this workspace.")];
    }

    return packages.map((packageFile) => new PackageItem(packageFile));
  }

  private getScriptItems(
    packageFile: PackageScriptFile,
    displayOptions: ScriptDisplayOptions,
    emptyMessage = "No scripts found."
  ): RunItem[] {
    const allNames = orderScriptNames(Object.keys(packageFile.scripts), displayOptions.sortOrder);
    if (allNames.length === 0) {
      return [new MessageItem(emptyMessage)];
    }

    const packageUri = packageFile.packageJsonUri.fsPath;
    const { pinned, rest } = partitionByPinned(allNames, packageUri, this.pinnedService);

    const items: RunItem[] = [];

    if (pinned.length > 0) {
      items.push(new PinnedHeaderItem());
      for (let i = 0; i < pinned.length; i++) {
        const position: PinnedPosition =
          pinned.length === 1 ? "only" : i === 0 ? "first" : i === pinned.length - 1 ? "last" : "middle";
        items.push(new ScriptItem(packageFile, pinned[i], displayOptions, position));
      }
    }

    for (const name of rest) {
      items.push(
        isCommentScriptKey(name)
          ? new SectionHeaderItem(name)
          : new ScriptItem(packageFile, name, displayOptions, null)
      );
    }

    return items;
  }
}

function partitionByPinned(
  scriptNames: string[],
  packageUri: string,
  pinnedService: PinnedScriptsService
): { pinned: string[]; rest: string[] } {
  const scriptSet = new Set(scriptNames);
  // preserve storage order for pinned so move-up/down is meaningful
  const pinned = pinnedService
    .pinnedNamesFor(packageUri)
    .filter((name) => scriptSet.has(name) && !isCommentScriptKey(name));
  const pinnedSet = new Set(pinned);
  const rest = scriptNames.filter((name) => !pinnedSet.has(name));

  return { pinned, rest };
}

function isCommentScriptKey(scriptName: string): boolean {
  return scriptName.trimStart().startsWith("//");
}

function orderScriptNames(scriptNames: string[], sortOrder: SortOrder): string[] {
  if (sortOrder === "alphabetical") {
    return [...scriptNames].sort((left, right) => left.localeCompare(right));
  }

  if (sortOrder === "alphabeticalGrouped") {
    const ordered: string[] = [];
    let buffer: string[] = [];

    const flush = (): void => {
      buffer.sort((left, right) => left.localeCompare(right));
      ordered.push(...buffer);
      buffer = [];
    };

    for (const name of scriptNames) {
      if (isCommentScriptKey(name)) {
        flush();
        ordered.push(name);
        continue;
      }
      buffer.push(name);
    }
    flush();

    return ordered;
  }

  return scriptNames;
}

type PinnedPosition = "first" | "middle" | "last" | "only";

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
    displayOptions: ScriptDisplayOptions,
    pinnedPosition: PinnedPosition | null
  ) {
    super(buildScriptLabel(scriptName, displayOptions.uiMode), vscode.TreeItemCollapsibleState.None);

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
    this.description = buildScriptDescription(scriptValue, displayOptions.uiMode);
    this.tooltip = new vscode.MarkdownString(
      [
        displayOptions.uiMode === "button" ? `**Action:** Click to run \`${scriptName}\`` : undefined,
        `**Script:** \`${scriptName}\``,
        `**Command:** \`${scriptValue}\``,
        `**Package:** ${packageFile.displayName}`
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n")
    );
    this.contextValue = pinnedPosition ? `script.pinned.${pinnedPosition}` : "script";

    if (pinnedPosition) {
      this.iconPath = new vscode.ThemeIcon(
        "pinned",
        displayOptions.uiMode === "button" ? new vscode.ThemeColor("terminal.ansiGreen") : undefined
      );
    } else if (displayOptions.showPlayIcon) {
      this.iconPath =
        displayOptions.uiMode === "button"
          ? new vscode.ThemeIcon("play-circle", new vscode.ThemeColor("terminal.ansiGreen"))
          : new vscode.ThemeIcon("play-circle");
    }
  }
}

class MessageItem extends RunItem {
  public constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.iconPath = new vscode.ThemeIcon("info");
  }
}

class PinnedHeaderItem extends RunItem {
  public constructor() {
    super("Pinned", vscode.TreeItemCollapsibleState.None);

    this.contextValue = "pinnedHeader";
    this.iconPath = new vscode.ThemeIcon("pinned");
  }
}

class SectionHeaderItem extends RunItem {
  public constructor(rawKey: string) {
    super(formatSectionLabel(rawKey), vscode.TreeItemCollapsibleState.None);

    this.contextValue = "sectionHeader";
    this.tooltip = rawKey;
    this.description = "";
  }
}

function formatSectionLabel(rawKey: string): string {
  const trimmed = rawKey.trim().replace(/^\/+/, "");
  const stripped = trimmed.replace(/^[=\-\s]+|[=\-\s]+$/g, "").trim();
  return stripped.length > 0 ? stripped : rawKey;
}

function buildScriptLabel(scriptName: string, uiMode: ScriptUiMode): string {
  return uiMode === "button" ? `Run ${scriptName}` : scriptName;
}

function buildScriptDescription(scriptValue: string, uiMode: ScriptUiMode): string {
  if (uiMode !== "button") {
    return scriptValue;
  }

  return toSingleLinePreview(scriptValue, 52);
}

function toSingleLinePreview(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}
