import * as vscode from "vscode";
import { TerminalMode, getConfig } from "../config";
import { RunStateService } from "./runStateService";

export interface ScriptRunRequest {
  packageDir: vscode.Uri;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  scriptName: string;
  terminalTitle: string;
  /** Extra arguments, passed through to the script as typed (shell syntax). */
  args?: string;
}

/** How long a new terminal gets to start shell integration before we run without it. */
const SHELL_INTEGRATION_WAIT_MS = 3000;

export class TerminalService implements vscode.Disposable {
  private sharedTerminal: vscode.Terminal | undefined;
  private sharedTerminalCwd: string | undefined;
  private lastRun: ScriptRunRequest | undefined;
  /** Set once a terminal's shell integration fails to start in time, so a
   *  shell without it doesn't delay every run; terminals that already have
   *  it are still used. */
  private integrationTimedOut = false;
  private readonly disposables: vscode.Disposable[];

  public constructor(private readonly runState: RunStateService) {
    this.disposables = [
      // A terminal that was only slow to start its integration clears the
      // flag, so one slow start doesn't turn run status off for the session.
      ...(runState.supported
        ? [vscode.window.onDidChangeTerminalShellIntegration(() => (this.integrationTimedOut = false))]
        : []),
      vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === this.sharedTerminal) {
          this.sharedTerminal = undefined;
          this.sharedTerminalCwd = undefined;
        }
      })
    ];
  }

  public get last(): ScriptRunRequest | undefined {
    return this.lastRun;
  }

  public async run(request: ScriptRunRequest): Promise<void> {
    const config = getConfig();
    const terminal = this.getTerminal(request, config.terminalMode);
    const shouldFocus = config.focusTerminal;
    const command = buildRunCommand(request);

    terminal.show(!shouldFocus);
    this.lastRun = request;

    // Through shell integration the run can be followed to its exit code
    // (running / succeeded / failed in the sidebar); without it, just type it.
    let shellIntegration: vscode.TerminalShellIntegration | undefined;
    if (this.runState.supported) {
      shellIntegration =
        terminal.shellIntegration ??
        (this.integrationTimedOut
          ? undefined
          : await waitForShellIntegration(terminal, SHELL_INTEGRATION_WAIT_MS));
      if (!shellIntegration) {
        this.integrationTimedOut = true;
      }
    }
    if (shellIntegration) {
      const execution = shellIntegration.executeCommand(command);
      this.runState.track(
        RunStateService.keyFor(request.packageDir, request.scriptName),
        terminal,
        execution
      );
      return;
    }

    terminal.sendText(command, true);
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
  const base = `${request.packageManager} run ${escapeShellArgument(request.scriptName)}`;
  const args = request.args?.trim();
  if (!args) {
    return base;
  }
  // npm needs "--" before arguments meant for the script; pnpm, yarn and
  // bun pass them through as they are.
  return request.packageManager === "npm" ? `${base} -- ${args}` : `${base} ${args}`;
}

function waitForShellIntegration(
  terminal: vscode.Terminal,
  timeoutMs: number
): Promise<vscode.TerminalShellIntegration | undefined> {
  if (terminal.shellIntegration) {
    return Promise.resolve(terminal.shellIntegration);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      listener.dispose();
      resolve(undefined);
    }, timeoutMs);
    const listener = vscode.window.onDidChangeTerminalShellIntegration((event) => {
      if (event.terminal === terminal) {
        clearTimeout(timer);
        listener.dispose();
        resolve(event.shellIntegration);
      }
    });
  });
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
