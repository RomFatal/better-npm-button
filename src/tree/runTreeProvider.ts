import * as vscode from "vscode";
import { RunScope, ScriptColor, ScriptUiMode, SortOrder, getConfig } from "../config";
import { PackageScriptFile } from "../services/packageDiscoveryService";
import { PinnedScriptsService } from "../services/pinnedScriptsService";
import { ScriptColorService } from "../services/scriptColorService";

export interface ScriptRunItem {
  packageFile: PackageScriptFile;
  scriptName: string;
}

interface ScriptDisplayOptions {
  showPlayIcon: boolean;
  uiMode: ScriptUiMode;
  sortOrder: SortOrder;
  accentColor: ScriptColor;
  colorService: ScriptColorService;
  packageUri: string;
}

export class RunTreeProvider implements vscode.TreeDataProvider<RunItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<RunItem | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(
    private readonly loadPackages: (scope: RunScope) => Promise<PackageScriptFile[]>,
    private readonly pinnedService: PinnedScriptsService,
    private readonly colorService: ScriptColorService
  ) {}

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: RunItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: RunItem): Promise<RunItem[]> {
    const config = getConfig();

    const baseOptions = {
      showPlayIcon: config.showPlayIcon,
      uiMode: config.scriptUiMode,
      sortOrder: config.sortOrder,
      accentColor: config.accentColor,
      colorService: this.colorService,
      packageUri: ""
    };

    if (!element) {
      const packages = await this.loadPackages(config.scope);
      return this.getRootItems(packages, config.scope, baseOptions);
    }

    if (element instanceof PackageItem) {
      return this.getScriptItems(element.packageFile, {
        ...baseOptions,
        packageUri: element.packageFile.packageJsonUri.fsPath
      });
    }

    if (element instanceof SectionGroupItem) {
      return element.sectionChildren;
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

      return this.getScriptItems(packageFile, {
        ...displayOptions,
        packageUri: packageFile.packageJsonUri.fsPath
      }, "No scripts found in the root package.json.");
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

    let currentGroup: SectionGroupItem | null = null;

    for (const name of rest) {
      if (isCommentScriptKey(name)) {
        currentGroup = new SectionGroupItem(name);
        items.push(currentGroup);
      } else {
        const scriptItem = new ScriptItem(packageFile, name, displayOptions, null);
        if (currentGroup) {
          currentGroup.sectionChildren.push(scriptItem);
        } else {
          items.push(scriptItem);
        }
      }
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

const DECORATION_URI_SCHEME = "runsidebar-color";

export const THEME_COLOR_MAP: Record<Exclude<ScriptColor, "default">, string> = {
  green: "terminal.ansiGreen",
  blue: "terminal.ansiBlue",
  red: "terminal.ansiRed",
  yellow: "terminal.ansiYellow",
  cyan: "terminal.ansiCyan",
  magenta: "terminal.ansiMagenta"
};

function resolveColorName(
  scriptName: string,
  displayOptions: ScriptDisplayOptions
): Exclude<ScriptColor, "default"> | null {
  const individual = displayOptions.colorService.getColor(scriptName, displayOptions.packageUri);
  const effective = individual ?? displayOptions.accentColor;

  if (effective !== "default") {
    return effective;
  }

  return displayOptions.uiMode === "button" ? "green" : null;
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

export class ScriptItem extends RunItem {
  public readonly packageFile: PackageScriptFile;
  public readonly scriptName: string;

  public constructor(
    packageFile: PackageScriptFile,
    scriptName: string,
    displayOptions: ScriptDisplayOptions,
    pinnedPosition: PinnedPosition | null
  ) {
    super(buildScriptLabel(scriptName, displayOptions.uiMode), vscode.TreeItemCollapsibleState.None);
    this.packageFile = packageFile;
    this.scriptName = scriptName;

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

    const colorName = resolveColorName(scriptName, displayOptions);
    const themeColor = colorName ? new vscode.ThemeColor(THEME_COLOR_MAP[colorName]) : undefined;

    if (pinnedPosition) {
      this.iconPath = new vscode.ThemeIcon("pinned", themeColor);
    } else if (displayOptions.showPlayIcon) {
      this.iconPath = new vscode.ThemeIcon("play-circle", themeColor);
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

class SectionGroupItem extends RunItem {
  public readonly sectionChildren: ScriptItem[] = [];

  public constructor(rawKey: string) {
    super(formatSectionLabel(rawKey), vscode.TreeItemCollapsibleState.Expanded);

    this.contextValue = "sectionGroup";
    this.tooltip = rawKey;
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
