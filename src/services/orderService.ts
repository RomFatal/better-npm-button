import * as vscode from "vscode";

const STORAGE_KEY = "runSidebar.customOrder";

/**
 * The order the user dragged things into, per workspace. Keyed by
 * container (a package's top level in one grouping, or one group), each
 * holding item keys ("s:<script>" / "g:<group id>") in the chosen order.
 * package.json itself is never changed.
 */
export class OrderService {
  private orders: Record<string, string[]>;

  public constructor(private readonly state: vscode.Memento) {
    this.orders = { ...state.get<Record<string, string[]>>(STORAGE_KEY, {}) };
  }

  /**
   * `items` sorted by the saved order of `containerId`. Items the saved
   * order doesn't mention (new scripts, new groups) keep their original
   * relative order, after the arranged ones.
   */
  public apply<T extends { orderKey?: string }>(containerId: string, items: T[]): T[] {
    const saved = this.orders[containerId];
    if (!saved || saved.length === 0) {
      return items;
    }
    const rank = new Map(saved.map((key, index) => [key, index]));
    return items
      .map((item, index) => ({ item, index, rank: rank.get(item.orderKey ?? "") }))
      .sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined) {
          return a.rank - b.rank;
        }
        if (a.rank !== undefined) {
          return -1;
        }
        if (b.rank !== undefined) {
          return 1;
        }
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }

  public set(containerId: string, keys: string[]): Thenable<void> {
    this.orders[containerId] = keys;
    return this.state.update(STORAGE_KEY, this.orders);
  }

  public clearAll(): Thenable<void> {
    this.orders = {};
    return this.state.update(STORAGE_KEY, undefined);
  }
}
