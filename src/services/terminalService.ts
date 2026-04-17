import * as vscode from "vscode";
import { TerminalMode, getConfig } from "../config";

export interface ScriptRunRequest {
  packageDir: vscode.Uri;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  scriptName: string;
  terminalTitle: string;
}

export class TerminalService implements vscode.Disposable {
  private sharedTerminal: vscode.Terminal | undefined;
  private sharedTerminalCwd: string | undefined;
  private lastRun: ScriptRunRequest | undefined;
  private readonly disposables: vscode.Disposable[];

  public constructor() {
    this.disposables = [
      vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === this.sharedTerminal) {
          this.sharedTerminal = undefined;
          this.sharedTerminalCwd = undefined;
        }
      })
    ];
  }

  public run(request: ScriptRunRequest): void {
    const config = getConfig();
    const terminal = this.getTerminal(request, config.terminalMode);
    const shouldFocus = config.focusTerminal;

    terminal.show(!shouldFocus);

    terminal.sendText(buildRunCommand(request), true);
    this.lastRun = request;
  }

  public rerunLast(): boolean {
    if (!this.lastRun) {
      return false;
    }

    this.run(this.lastRun);
    return true;
  }

  public dispose(): void {
    this.sharedTerminal?.dispose();
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private getTerminal(request: ScriptRunRequest, terminalMode: TerminalMode): vscode.Terminal {
    if (terminalMode === "new") {
      return vscode.window.createTerminal({
        name: request.terminalTitle,
        cwd: request.packageDir
      });
    }

    if (!this.sharedTerminal) {
      this.sharedTerminal = createSharedTerminal(request.packageDir);
      this.sharedTerminalCwd = normalizeDirectoryKey(request.packageDir.fsPath);
      return this.sharedTerminal;
    }

    const nextCwd = normalizeDirectoryKey(request.packageDir.fsPath);
    if (this.sharedTerminalCwd !== nextCwd) {
      this.sharedTerminal.dispose();
      this.sharedTerminal = createSharedTerminal(request.packageDir);
      this.sharedTerminalCwd = nextCwd;
    }

    return this.sharedTerminal;
  }
}

function buildRunCommand(request: ScriptRunRequest): string {
  return `${request.packageManager} run ${escapeShellArgument(request.scriptName)}`;
}

function createSharedTerminal(packageDir: vscode.Uri): vscode.Terminal {
  return vscode.window.createTerminal({
    name: "Run",
    cwd: packageDir
  });
}

function normalizeDirectoryKey(directoryPath: string): string {
  if (process.platform === "win32") {
    return directoryPath.toLowerCase();
  }

  return directoryPath;
}

function escapeShellArgument(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}
