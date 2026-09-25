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

  public moveUp(scriptName: string, packageJsonUri: string): void {
    const entries = this.getAll();
    const idx = entries.findIndex(
      (e) => e.scriptName === scriptName && e.packageJsonUri === packageJsonUri
    );
    if (idx <= 0) {
      return;
    }
    [entries[idx - 1], entries[idx]] = [entries[idx], entries[idx - 1]];
    void this.state.update(STORAGE_KEY, entries);
  }

  public moveDown(scriptName: string, packageJsonUri: string): void {
    const entries = this.getAll();
    const idx = entries.findIndex(
      (e) => e.scriptName === scriptName && e.packageJsonUri === packageJsonUri
    );
    if (idx === -1 || idx >= entries.length - 1) {
      return;
    }
    [entries[idx], entries[idx + 1]] = [entries[idx + 1], entries[idx]];
    void this.state.update(STORAGE_KEY, entries);
  }

  /**
   * Sets one package's pinned scripts to exactly `scriptNames`, in that
   * order (drag and drop). Other packages' pins are left as they are.
   */
  public setPinnedFor(packageJsonUri: string, scriptNames: string[]): Thenable<void> {
    const others = this.getAll().filter((e) => e.packageJsonUri !== packageJsonUri);
    return this.state.update(STORAGE_KEY, [
      ...others,
      ...scriptNames.map((scriptName) => ({ scriptName, packageJsonUri }))
    ]);
  }

  public pinnedNamesFor(packageJsonUri: string): string[] {
    return this.getAll()
      .filter((e) => e.packageJsonUri === packageJsonUri)
      .map((e) => e.scriptName);
  }

  public getAll(): PinnedEntry[] {
    return this.state.get<PinnedEntry[]>(STORAGE_KEY, []);
  }
}
