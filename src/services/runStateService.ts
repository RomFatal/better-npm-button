import * as vscode from "vscode";

export type RunStatus = "running" | "succeeded" | "failed" | "stopped";

export interface RunState {
  status: RunStatus;
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
}

/**
 * Tracks whether each script is running and how its last run ended, from
 * VS Code's terminal shell integration (VS Code 1.93+). TerminalService runs
 * the command through `shellIntegration.executeCommand` when the terminal
 * has it, and hands us the execution; its end event carries the exit code.
 * Runs sent without shell integration aren't tracked, so the sidebar never
 * shows a spinner it can't stop.
 *
 * State is per session: it starts empty each time VS Code opens.
 */
export class RunStateService implements vscode.Disposable {
  private readonly states = new Map<string, RunState>();
  private readonly executions = new Map<vscode.TerminalShellExecution, string>();
  /** The tracked run currently in each terminal. */
  private readonly byTerminal = new Map<vscode.Terminal, string>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();

  public readonly onDidChange = this.onDidChangeEmitter.event;
  /** False on VS Code builds without the shell execution API. */
  public readonly supported: boolean;

  public constructor() {
    const window = vscode.window as Partial<typeof vscode.window>;
    this.supported =
      typeof window.onDidEndTerminalShellExecution === "function" &&
      typeof window.onDidChangeTerminalShellIntegration === "function";

    if (this.supported) {
      this.disposables.push(
        vscode.window.onDidEndTerminalShellExecution((event) => this.onEnd(event))
      );
    }
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => this.onClose(terminal)),
      this.onDidChangeEmitter
    );
  }

  public static keyFor(packageDir: vscode.Uri, scriptName: string): string {
    return `${packageDir.fsPath}\u0000${scriptName}`;
  }

  public get(key: string): RunState | undefined {
    return this.states.get(key);
  }

  /** Called when a script's command starts through shell integration. */
  public track(key: string, terminal: vscode.Terminal, execution: vscode.TerminalShellExecution): void {
    // A run still going in a reused terminal is superseded by this one.
    const previous = this.byTerminal.get(terminal);
    if (previous && previous !== key && this.states.get(previous)?.status === "running") {
      this.finish(previous, "stopped");
    }

    this.byTerminal.set(terminal, key);
    this.executions.set(execution, key);
    this.states.set(key, { status: "running", startedAt: Date.now() });
    this.onDidChangeEmitter.fire();
  }

  public dispose(): void {
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private onEnd(event: vscode.TerminalShellExecutionEndEvent): void {
    const key = this.executions.get(event.execution);
    if (!key) {
      return;
    }
    this.executions.delete(event.execution);
    const exitCode = event.exitCode;
    this.finish(
      key,
      exitCode === undefined ? "stopped" : exitCode === 0 ? "succeeded" : "failed",
      exitCode
    );
  }

  private onClose(terminal: vscode.Terminal): void {
    const key = this.byTerminal.get(terminal);
    this.byTerminal.delete(terminal);
    if (key && this.states.get(key)?.status === "running") {
      this.finish(key, "stopped");
    }
  }

  private finish(key: string, status: RunStatus, exitCode?: number): void {
    const state = this.states.get(key);
    if (!state || state.status !== "running") {
      return;
    }
    this.states.set(key, { ...state, status, endedAt: Date.now(), exitCode });
    this.onDidChangeEmitter.fire();
  }
}

/** 850 → "0.9s", 64_000 → "1m 4s", 3_700_000 → "1h 1m". */
export function formatDuration(ms: number): string {
  if (ms < 10_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
