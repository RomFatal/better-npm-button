import * as vscode from "vscode";
import { OrderService } from "../services/orderService";
import { PinnedScriptsService } from "../services/pinnedScriptsService";
import { RunItem, ScriptItem, SectionGroupItem } from "./runTreeProvider";

const MIME = "application/vnd.code.tree.runsidebar.scripts";

/**
 * Drag and drop in the Scripts view. The saved order lives in OrderService
 * (and the pin list for Pinned); package.json is never changed, which is
 * why a script can't move into a different section or stage group — its
 * group comes from package.json.
 *
 *  - a script onto a script in the same group → takes its place
 *  - a group onto a group (or a top-level script) → takes its place
 *  - a script onto Pinned or a pinned script → pinned, at that spot
 *  - a pinned script onto a pinned script → reordered
 *  - a pinned script onto anything else in its package → unpinned
 */
export class ScriptsDragAndDrop implements vscode.TreeDragAndDropController<RunItem> {
  public readonly dragMimeTypes = [MIME];
  public readonly dropMimeTypes = [MIME];

  public constructor(
    private readonly order: OrderService,
    private readonly pinned: PinnedScriptsService,
    private readonly refresh: () => void
  ) {}

  public handleDrag(source: readonly RunItem[], dataTransfer: vscode.DataTransfer): void {
    const item = source[0];
    const draggable =
      (item instanceof ScriptItem || (item instanceof SectionGroupItem && !item.isPinnedGroup)) &&
      item.containerId !== undefined;
    if (draggable) {
      dataTransfer.set(MIME, new vscode.DataTransferItem(item));
    }
  }

  public async handleDrop(target: RunItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const source = dataTransfer.get(MIME)?.value as RunItem | undefined;
    if (!source || !target || source === target) {
      return;
    }
    if (source.packageUri !== target.packageUri) {
      return explain("Scripts can only be moved within their own package.");
    }

    const done = await this.drop(source, target);
    if (done === true) {
      this.refresh();
    } else if (typeof done === "string") {
      explain(done);
    }
  }

  /** true when something changed, a message when the move isn't possible. */
  private async drop(source: RunItem, target: RunItem): Promise<true | string | undefined> {
    const packageUri = source.packageUri as string;
    const targetIsPinned =
      (target instanceof SectionGroupItem && target.isPinnedGroup) ||
      (target instanceof ScriptItem && target.isPinned);

    if (source instanceof ScriptItem) {
      if (source.isPinned && !targetIsPinned) {
        this.pinned.unpin(source.scriptName, packageUri);
        return true;
      }
      if (targetIsPinned) {
        const names = pinnedNamesAt(target).filter((name) => name !== source.scriptName);
        const index =
          target instanceof ScriptItem ? pinnedNamesAt(target).indexOf(target.scriptName) : 0;
        names.splice(Math.max(0, Math.min(index, names.length)), 0, source.scriptName);
        await this.pinned.setPinnedFor(packageUri, names);
        return true;
      }
      // Dropped on its own group's header: to the top of the group.
      if (target instanceof SectionGroupItem && target.id === source.containerId) {
        return this.save(source, source.siblingKeys?.[0]);
      }
      if (target.containerId === source.containerId) {
        return this.save(source, target.orderKey);
      }
      return 'A script stays in its own group: its "//" section or "stage" comes from package.json.';
    }

    if (source instanceof SectionGroupItem) {
      if (target.containerId === source.containerId && !targetIsPinned) {
        return this.save(source, target.orderKey);
      }
      return "Groups can only be moved among the other groups.";
    }

    return undefined;
  }

  /** Moves `source` to `targetKey`'s place in their shared list and saves it. */
  private async save(source: RunItem, targetKey: string | undefined): Promise<true | undefined> {
    const keys = [...(source.siblingKeys ?? [])];
    const from = keys.indexOf(source.orderKey ?? "");
    const to = targetKey === undefined ? -1 : keys.indexOf(targetKey);
    if (from === -1 || to === -1 || from === to || !source.containerId) {
      return undefined;
    }
    keys.splice(from, 1);
    keys.splice(to, 0, source.orderKey as string);
    await this.order.set(source.containerId, keys);
    return true;
  }
}

/** Script names of the Pinned list a pinned item belongs to. */
function pinnedNamesAt(target: RunItem): string[] {
  const keys =
    target instanceof SectionGroupItem
      ? target.sectionChildren.map((child) => child.orderKey ?? "")
      : target.siblingKeys ?? [];
  return keys.filter((key) => key.startsWith("s:")).map((key) => key.slice(2));
}

function explain(message: string): void {
  vscode.window.setStatusBarMessage(`$(info) ${message}`, 5000);
}
