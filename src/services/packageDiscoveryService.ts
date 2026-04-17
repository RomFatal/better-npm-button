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
}

interface PackageJsonShape {
  name?: string;
  scripts?: Record<string, string>;
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

      return {
        workspaceFolder,
        packageJsonUri,
        packageDir,
        packageName: packageJson.name,
        displayName: buildDisplayName(workspaceFolder, relativeDirectory, packageJson.name),
        relativeDirectory,
        scripts
      };
    } catch {
      return undefined;
    }
  }
}

function normalizeScripts(scripts: PackageJsonShape["scripts"]): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (!scripts) {
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
