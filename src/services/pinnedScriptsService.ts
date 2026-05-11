import * as vscode from "vscode";

const STORAGE_KEY = "runSidebar.pinnedScripts";

interface PinnedEntry {
  scriptName: string;
  packageJsonUri: string;
}

export class PinnedScriptsService {
  public constructor(private readonly state: vscode.Memento) {}

  public isPinned(scriptName: string, packageJsonUri: string): boolean {
    return this.getAll().some(
      (e) => e.scriptName === scriptName && e.packageJsonUri === packageJsonUri
    );
  }

  public pin(scriptName: string, packageJsonUri: string): void {
    if (this.isPinned(scriptName, packageJsonUri)) {
      return;
    }
    void this.state.update(STORAGE_KEY, [...this.getAll(), { scriptName, packageJsonUri }]);
  }

  public unpin(scriptName: string, packageJsonUri: string): void {
    void this.state.update(
      STORAGE_KEY,
      this.getAll().filter(
        (e) => !(e.scriptName === scriptName && e.packageJsonUri === packageJsonUri)
      )
    );
  }

  public getAll(): PinnedEntry[] {
    return this.state.get<PinnedEntry[]>(STORAGE_KEY, []);
  }
}
