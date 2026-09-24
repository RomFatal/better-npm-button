import * as path from "path";
import * as vscode from "vscode";
import { RunScope } from "../config";

export interface PackageScriptFile {
  workspaceFolder: vscode.WorkspaceFolder;
  packageJsonUri: vscode.Uri;
  packageDir: vscode.Uri;
  packageName?: string;
  displayName: string;
  relativeDirectory: string;
  scripts: Record<string, string>;
  /** What each script does, keyed by script name, from "scripts-info" (or ntl.descriptions). */
  scriptInfo: Record<string, ScriptInfo>;
}

/**
 * One "scripts-info" entry. Written either as a plain string (the description)
 * or as an object: `description` plus any other fields, which the tooltip
 * shows as labelled lines — e.g. { "description": "…", "env": "prod server" }.
 */
export interface ScriptInfo {
  description?: string;
  /** Workflow step the script belongs to ("develop", "release"…), for Group by Stage. */
  stage?: string;
  /** Ask before running: true, or the warning text to show. */
  confirm?: true | string;
  /** Extra fields in package.json order, as [label, value]: [["Env", "prod server"]]. */
  details: Array<[string, string]>;
}

interface PackageJsonShape {
  name?: string;
  scripts?: Record<string, string>;
  "scripts-info"?: Record<string, unknown>;
  ntl?: { descriptions?: Record<string, unknown> };
}

export class PackageDiscoveryService {
  public async listPackages(scope: RunScope): Promise<PackageScriptFile[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
      return [];
    }

    if (scope === "root") {
      const firstFolder = workspaceFolders[0];
      const packageJsonUri = vscode.Uri.joinPath(firstFolder.uri, "package.json");
      const packageFile = await this.readPackage(packageJsonUri, firstFolder);
      return packageFile ? [packageFile] : [];
    }

    const packageFiles = await Promise.all(
      workspaceFolders.map(async (folder) => {
        const discoveredUris = await vscode.workspace.findFiles(
          new vscode.RelativePattern(folder, "**/package.json"),
          new vscode.RelativePattern(folder, "**/{node_modules,.git}/**")
        );

        const filteredUris = discoveredUris.filter((uri) => !hasIgnoredSegment(uri));
        const packages = await Promise.all(filteredUris.map((uri) => this.readPackage(uri, folder)));
        return packages.filter((entry): entry is PackageScriptFile => Boolean(entry));
      })
    );

    return packageFiles.flat().sort((left, right) => comparePackages(left, right));
  }

  private async readPackage(
    packageJsonUri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<PackageScriptFile | undefined> {
    try {
      const fileContent = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(Buffer.from(fileContent).toString("utf8")) as PackageJsonShape;

      if (typeof packageJson !== "object" || packageJson === null) {
        return undefined;
      }

      const packageDir = vscode.Uri.joinPath(packageJsonUri, "..");
      const relativeDirectory = path.posix.relative(workspaceFolder.uri.path, packageDir.path) || ".";
      const scripts = normalizeScripts(packageJson.scripts);
      const scriptInfo = {
        ...parseScriptInfo(packageJson.ntl?.descriptions),
        ...parseScriptInfo(packageJson["scripts-info"])
      };

      return {
        workspaceFolder,
        packageJsonUri,
        packageDir,
        packageName: packageJson.name,
        displayName: buildDisplayName(workspaceFolder, relativeDirectory, packageJson.name),
        relativeDirectory,
        scripts,
        scriptInfo
      };
    } catch {
      return undefined;
    }
  }
}

function parseScriptInfo(raw: Record<string, unknown> | undefined): Record<string, ScriptInfo> {
  const parsed: Record<string, ScriptInfo> = {};

  if (!raw || typeof raw !== "object") {
    return parsed;
  }

  for (const [scriptName, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      parsed[scriptName] = { description: value, details: [] };
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    const info: ScriptInfo = { details: [] };
    for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
      if (typeof field !== "string" && typeof field !== "number" && typeof field !== "boolean") {
        continue;
      }
      if (key === "description" && typeof field === "string") {
        info.description = field;
      } else if (key === "confirm") {
        // false / "" mean "don't ask"; anything else asks.
        if (field === true) {
          info.confirm = true;
        } else if (typeof field === "string" && field.trim()) {
          info.confirm = field.trim();
        }
      } else if (key === "stage" && typeof field === "string" && field.trim()) {
        info.stage = field.trim();
        info.details.push(["Stage", info.stage]);
      } else {
        info.details.push([toLabel(key), String(field)]);
      }
    }
    if (info.description !== undefined || info.details.length > 0 || info.confirm) {
      parsed[scriptName] = info;
    }
  }

  return parsed;
}

/** "env" → "Env", "requiresDocker" / "requires_docker" → "Requires docker". */
function toLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Keeps the string entries of a name → text map; anything else is ignored. */
function normalizeScripts(scripts: Record<string, unknown> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (!scripts || typeof scripts !== "object") {
    return normalized;
  }

  for (const [scriptName, scriptValue] of Object.entries(scripts)) {
    if (typeof scriptValue === "string") {
      normalized[scriptName] = scriptValue;
    }
  }

  return normalized;
}

function buildDisplayName(
  workspaceFolder: vscode.WorkspaceFolder,
  relativeDirectory: string,
  packageName?: string
): string {
  if (relativeDirectory === ".") {
    return packageName ? `${workspaceFolder.name} (${packageName})` : workspaceFolder.name;
  }

  return packageName ? `${relativeDirectory} (${packageName})` : relativeDirectory;
}

function hasIgnoredSegment(uri: vscode.Uri): boolean {
  const ignoredSegments = new Set(["node_modules", ".git"]);
  return uri.path.split("/").some((segment) => ignoredSegments.has(segment));
}

function comparePackages(left: PackageScriptFile, right: PackageScriptFile): number {
  if (left.workspaceFolder.index !== right.workspaceFolder.index) {
    return left.workspaceFolder.index - right.workspaceFolder.index;
  }

  if (left.relativeDirectory === "." && right.relativeDirectory !== ".") {
    return -1;
  }

  if (left.relativeDirectory !== "." && right.relativeDirectory === ".") {
    return 1;
  }

  return left.displayName.localeCompare(right.displayName);
}
