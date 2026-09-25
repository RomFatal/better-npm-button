import * as vscode from "vscode";
import { GroupBy, RunScope, ScriptColor, ScriptDescription, ScriptUiMode, SortOrder, getConfig } from "../config";
import { PackageScriptFile, ScriptInfo } from "../services/packageDiscoveryService";
import { PinnedScriptsService } from "../services/pinnedScriptsService";
import { ScriptColorService } from "../services/scriptColorService";
import { RunState, RunStateService, formatDuration } from "../services/runStateService";

export interface ScriptRunItem {
  packageFile: PackageScriptFile;
  scriptName: string;
}

interface ScriptDisplayOptions {
  showPlayIcon: boolean;
  uiMode: ScriptUiMode;
  sortOrder: SortOrder;
  accentColor: ScriptColor;
  scriptDescription: ScriptDescription;
  showEnvIcons: boolean;
  groupBy: GroupBy;
  /** Run status of a script by RunStateService key, or undefined when not shown. */
  runStateOf: (key: string) => RunState | undefined;
  colorService: ScriptColorService;
  packageUri: string;
}

export class RunTreeProvider implements vscode.TreeDataProvider<RunItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<RunItem | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  /** "Show Only Pinned" filter from the title bar: the list shows pinned scripts only. */
  public pinnedOnly = false;

  public constructor(
    private readonly loadPackages: (scope: RunScope) => Promise<PackageScriptFile[]>,
    private readonly pinnedService: PinnedScriptsService,
    private readonly colorService: ScriptColorService,
    private readonly runState: RunStateService
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
      scriptDescription: config.scriptDescription,
      showEnvIcons: config.showEnvIcons,
      groupBy: config.groupBy,
      runStateOf: (key: string) => (config.showRunStatus ? this.runState.get(key) : undefined),
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

    if (this.pinnedOnly) {
      const withPins = packages.filter(
        (packageFile) => this.pinnedNames(packageFile).length > 0
      );
      return withPins.length > 0
        ? withPins.map((packageFile) => new PackageItem(packageFile))
        : [new MessageItem(NO_PINS_MESSAGE)];
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

    // Show Only Pinned: just the pinned scripts, in their pinned order.
    if (this.pinnedOnly) {
      if (pinned.length === 0) {
        return [new MessageItem(NO_PINS_MESSAGE)];
      }
      return pinned.map(
        (name, i) =>
          new ScriptItem(packageFile, name, displayOptions, pinnedPositionFor(i, pinned.length))
      );
    }

    const items: RunItem[] = [];

    if (pinned.length > 0) {
      items.push(new PinnedHeaderItem());
      for (let i = 0; i < pinned.length; i++) {
        items.push(
          new ScriptItem(packageFile, pinned[i], displayOptions, pinnedPositionFor(i, pinned.length))
        );
      }
    }

    if (displayOptions.groupBy === "stage") {
      items.push(...this.groupByStage(packageFile, rest, displayOptions));
      return items;
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

  private pinnedNames(packageFile: PackageScriptFile): string[] {
    const names = Object.keys(packageFile.scripts);
    return partitionByPinned(names, packageFile.packageJsonUri.fsPath, this.pinnedService).pinned;
  }

  /**
   * One group per "stage" in scripts-info, in the order stages first appear;
   * scripts without a stage go last, under "Other". // section headers are
   * left out: stages replace them in this view.
   */
  private groupByStage(
    packageFile: PackageScriptFile,
    names: string[],
    displayOptions: ScriptDisplayOptions
  ): RunItem[] {
    const groups = new Map<string, SectionGroupItem>();
    const other: ScriptItem[] = [];

    for (const name of names) {
      if (isCommentScriptKey(name)) {
        continue;
      }
      const item = new ScriptItem(packageFile, name, displayOptions, null);
      const stage = packageFile.scriptInfo[name]?.stage;
      if (!stage) {
        other.push(item);
        continue;
      }
      const key = stage.toLowerCase();
      let group = groups.get(key);
      if (!group) {
        group = new SectionGroupItem(stage, capitalize(stage));
        groups.set(key, group);
      }
      group.sectionChildren.push(item);
    }

    const result: RunItem[] = [...groups.values()];
    if (other.length > 0) {
      if (groups.size === 0) {
        return other;
      }
      const otherGroup = new SectionGroupItem("other", "Other");
      otherGroup.sectionChildren.push(...other);
      result.push(otherGroup);
    }
    return result;
  }
}

const NO_PINS_MESSAGE = "No pinned scripts. Hover a script and click the pin to add one.";

function pinnedPositionFor(index: number, count: number): PinnedPosition {
  if (count === 1) {
    return "only";
  }
  return index === 0 ? "first" : index === count - 1 ? "last" : "middle";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  displayOptions: ScriptDisplayOptions,
  envColor: Exclude<ScriptColor, "default"> | null = null
): Exclude<ScriptColor, "default"> | null {
  const individual = displayOptions.colorService.getColor(scriptName, displayOptions.packageUri);
  const effective = individual ?? displayOptions.accentColor;

  if (effective !== "default") {
    return effective;
  }

  if (envColor) {
    return envColor;
  }

  return displayOptions.uiMode === "button" ? "green" : null;
}

interface EnvStyle {
  icon: string;
  color: Exclude<ScriptColor, "default">;
}

/**
 * Environments the extension recognises in a script's "env" (or
 * "environment") field, by keyword, so any project gets the icons just by
 * writing e.g. "env": "prod server". First match wins.
 */
const ENV_STYLES: Array<{ pattern: RegExp; style: EnvStyle }> = [
  { pattern: /\b(prod|production|live)\b/i, style: { icon: "cloud", color: "red" } },
  {
    pattern: /\b(local|localhost|dev|development)\b/i,
    style: { icon: "device-desktop", color: "green" }
  }
];

function detectEnv(info: ScriptInfo | undefined): EnvStyle | null {
  const value = info?.details.find(([label]) => /^env(ironment)?$/i.test(label))?.[1];
  if (!value) {
    return null;
  }
  return ENV_STYLES.find(({ pattern }) => pattern.test(value))?.style ?? null;
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
    const scriptInfo = packageFile.scriptInfo[scriptName];

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
    // Grey text beside the name: the script's "scripts-info" description when
    // it has one (and the setting allows), otherwise the command itself.
    const inlineText =
      displayOptions.scriptDescription === "info" && scriptInfo?.description
        ? scriptInfo.description
        : scriptValue;
    const runState = displayOptions.runStateOf(RunStateService.keyFor(packageFile.packageDir, scriptName));
    const runBadge = runState ? formatRunBadge(runState) : "";
    this.description = runBadge + buildScriptDescription(inlineText, displayOptions.uiMode);
    // Info and its detail fields are plain text from package.json:
    // appendText escapes them. Each goes on its own line, before the
    // Script / Command / Package lines.
    const env = displayOptions.showEnvIcons ? detectEnv(scriptInfo) : null;
    const tooltip = new vscode.MarkdownString();
    // Lets the Env line carry its $(icon); appendText still escapes any
    // $(...) the user wrote, so only ours renders.
    tooltip.supportThemeIcons = true;
    const infoLines: Array<[string, string]> = [
      ...(scriptInfo?.description ? [["Info", scriptInfo.description] as [string, string]] : []),
      ...(scriptInfo?.details ?? [])
    ];
    for (const [label, text] of infoLines) {
      tooltip.appendMarkdown("**");
      tooltip.appendText(`${label}:`);
      tooltip.appendMarkdown("** ");
      if (env && /^env(ironment)?$/i.test(label)) {
        tooltip.appendMarkdown(`$(${env.icon}) `);
      }
      tooltip.appendText(text);
      tooltip.appendMarkdown("\n\n");
    }
    tooltip.appendMarkdown(
      [
        displayOptions.uiMode === "button" ? `**Action:** Click to run \`${scriptName}\`` : undefined,
        runState ? `**Last run:** ${describeRun(runState)}` : undefined,
        scriptInfo?.confirm ? "**Asks before running**" : undefined,
        `**Script:** \`${scriptName}\``,
        `**Command:** \`${scriptValue}\``,
        `**Package:** ${packageFile.displayName}`
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n")
    );
    this.tooltip = tooltip;
    this.contextValue = pinnedPosition ? `script.pinned.${pinnedPosition}` : "script";

    // A recognised env replaces the play icon (pinned rows keep the pin);
    // a color set on the script, or the accent color, still wins over the
    // env's own red/green.
    const colorName = resolveColorName(scriptName, displayOptions, pinnedPosition ? null : env?.color);
    const themeColor = colorName ? new vscode.ThemeColor(THEME_COLOR_MAP[colorName]) : undefined;

    if (runState?.status === "running") {
      this.iconPath = new vscode.ThemeIcon("loading~spin");
    } else if (pinnedPosition) {
      this.iconPath = new vscode.ThemeIcon("pinned", themeColor);
    } else if (env) {
      this.iconPath = new vscode.ThemeIcon(env.icon, themeColor);
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

  public constructor(rawKey: string, label = formatSectionLabel(rawKey)) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);

    this.contextValue = "sectionGroup";
    this.tooltip = rawKey;
  }
}

function formatSectionLabel(rawKey: string): string {
  const trimmed = rawKey.trim().replace(/^\/+/, "");
  const stripped = trimmed.replace(/^[=\-\s]+|[=\-\s]+$/g, "").trim();
  return stripped.length > 0 ? stripped : rawKey;
}

/** "✓ 3m 44s · " before the grey text; nothing while running (the icon spins). */
function formatRunBadge(state: RunState): string {
  if (state.status === "running" || state.endedAt === undefined) {
    return "";
  }
  const took = formatDuration(state.endedAt - state.startedAt);
  if (state.status === "succeeded") {
    return `✓ ${took} · `;
  }
  if (state.status === "failed") {
    return `✗ ${took} · `;
  }
  return `■ ${took} · `;
}

function describeRun(state: RunState): string {
  const started = new Date(state.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (state.status === "running" || state.endedAt === undefined) {
    return `running since ${started}`;
  }
  const took = formatDuration(state.endedAt - state.startedAt);
  if (state.status === "succeeded") {
    return `succeeded in ${took} (started ${started})`;
  }
  if (state.status === "failed") {
    return `failed with exit code ${state.exitCode} after ${took} (started ${started})`;
  }
  return `stopped after ${took} (started ${started})`;
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
