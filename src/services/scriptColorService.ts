import * as vscode from "vscode";
import { ScriptColor } from "../config";

const STORAGE_KEY = "runSidebar.scriptColors";

interface ColorEntry {
  scriptName: string;
  packageJsonUri: string;
  color: ScriptColor;
}

export class ScriptColorService {
  public constructor(private readonly state: vscode.Memento) {}

  public getColor(scriptName: string, packageJsonUri: string): ScriptColor | undefined {
    return this.getAll().find(
      (e) => e.scriptName === scriptName && e.packageJsonUri === packageJsonUri
    )?.color;
  }

  public setColor(scriptName: string, packageJsonUri: string, color: ScriptColor): void {
    const rest = this.getAll().filter(
      (e) => !(e.scriptName === scriptName && e.packageJsonUri === packageJsonUri)
    );
    // "default" means "clear individual override"
    const next = color === "default" ? rest : [...rest, { scriptName, packageJsonUri, color }];
    void this.state.update(STORAGE_KEY, next);
  }

  public getAll(): ColorEntry[] {
    return this.state.get<ColorEntry[]>(STORAGE_KEY, []);
  }
}
