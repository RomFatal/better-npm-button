import * as path from "path";
import * as vscode from "vscode";
import { PackageManager, getConfig } from "../config";

const LOCKFILES: Array<{ fileName: string; manager: Exclude<PackageManager, "auto"> }> = [
  { fileName: "bun.lockb", manager: "bun" },
  { fileName: "bun.lock", manager: "bun" },
  { fileName: "pnpm-lock.yaml", manager: "pnpm" },
  { fileName: "yarn.lock", manager: "yarn" },
  { fileName: "package-lock.json", manager: "npm" }
];

export class PackageManagerService {
  public async resolve(
    packageDir: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<Exclude<PackageManager, "auto">> {
    const configured = getConfig().packageManager;
    if (configured !== "auto") {
      return configured;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    let currentDirectory = packageDir.fsPath;

    while (isWithinWorkspace(currentDirectory, workspaceRoot)) {
      for (const lockfile of LOCKFILES) {
        const lockfileUri = vscode.Uri.file(path.join(currentDirectory, lockfile.fileName));
        if (await exists(lockfileUri)) {
          return lockfile.manager;
        }
      }

      if (currentDirectory === workspaceRoot) {
        break;
      }

      const parent = path.dirname(currentDirectory);
      if (parent === currentDirectory) {
        break;
      }

      currentDirectory = parent;
    }

    return "npm";
  }
}

function isWithinWorkspace(targetPath: string, workspaceRoot: string): boolean {
  const relativePath = path.relative(workspaceRoot, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
