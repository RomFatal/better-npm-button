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
  private lastRun: ScriptRunRequest | undefined;
  private readonly disposables: vscode.Disposable[];

  public constructor() {
    this.disposables = [
      vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === this.sharedTerminal) {
          this.sharedTerminal = undefined;
        }
      })
    ];
  }

  public run(request: ScriptRunRequest): void {
    const config = getConfig();
    const terminal = this.getTerminal(request, config.terminalMode);
    const shouldFocus = config.focusTerminal;

    terminal.show(!shouldFocus);

    terminal.sendText(buildRunCommand(request, config.terminalMode), true);
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
      this.sharedTerminal = vscode.window.createTerminal({
        name: "Run",
        cwd: request.packageDir
      });
    }

    return this.sharedTerminal;
  }
}

function buildRunCommand(request: ScriptRunRequest, terminalMode: TerminalMode): string {
  const runCommand = `${request.packageManager} run ${escapeShellArgument(request.scriptName)}`;
  if (terminalMode === "new") {
    return runCommand;
  }

  return `${buildChangeDirectoryCommand(request.packageDir.fsPath)} && ${runCommand}`;
}

function buildChangeDirectoryCommand(directoryPath: string): string {
  if (process.platform === "win32") {
    return `cd /d ${escapeShellArgument(directoryPath)}`;
  }

  return `cd ${escapeShellArgument(directoryPath)}`;
}

function escapeShellArgument(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}
