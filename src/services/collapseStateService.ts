import * as vscode from "vscode";
import { CollapseStore } from "../tree/runTreeProvider";

const STORAGE_KEY = "runSidebar.collapsedGroups";

/**
 * Remembers which groups and packages are collapsed, per workspace, by tree
 * item id. Only collapsed ids are stored; everything else starts open.
 */
export class CollapseStateService implements CollapseStore {
  private readonly collapsed: Set<string>;

  public constructor(private readonly state: vscode.Memento) {
    this.collapsed = new Set(state.get<string[]>(STORAGE_KEY, []));
  }

  public isCollapsed(id: string): boolean {
    return this.collapsed.has(id);
  }

  public async set(id: string, collapsed: boolean): Promise<void> {
    const changed = collapsed ? !this.collapsed.has(id) : this.collapsed.has(id);
    if (!changed) {
      return;
    }
    if (collapsed) {
      this.collapsed.add(id);
    } else {
      this.collapsed.delete(id);
    }
    await this.state.update(STORAGE_KEY, [...this.collapsed]);
  }
}
