import * as vscode from "vscode";
import { KeyLocation, locatePackageJson } from "./packageJsonLocator";

const SOURCE = "Better Npm Button";
const CODE_MISSING = "scripts-info-missing";
const CODE_ORPHAN = "scripts-info-orphan";

/**
 * Keeps "scripts-info" in step with "scripts", in the Problems panel:
 *  - a warning on an info entry for a script that no longer exists
 *  - a note on a script that has no info, with a quick fix that adds one
 *
 * Only for package.json files that already have a "scripts-info" block, so
 * projects that don't use the feature never see it. Section headers (keys
 * starting with //) are never expected to have info.
 */
export class ScriptsInfoValidator implements vscode.CodeActionProvider, vscode.Disposable {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  private readonly diagnostics = vscode.languages.createDiagnosticCollection("scripts-info");

  public validate(document: vscode.TextDocument, enabled: boolean): void {
    if (!isPackageJson(document.uri)) {
      return;
    }
    if (!enabled) {
      this.diagnostics.delete(document.uri);
      return;
    }

    const layout = locatePackageJson(document.getText());
    const scripts = layout.objects.get("scripts");
    const info = layout.objects.get("scripts-info");
    if (!scripts || !info) {
      this.diagnostics.delete(document.uri);
      return;
    }

    const scriptNames = new Set(scripts.keys.map((key) => key.name));
    const infoNames = new Set(info.keys.map((key) => key.name));
    const found: vscode.Diagnostic[] = [];

    for (const key of info.keys) {
      if (!scriptNames.has(key.name)) {
        found.push(
          diagnostic(
            document,
            key,
            `"scripts-info" describes "${key.name}", but there is no script called "${key.name}".`,
            vscode.DiagnosticSeverity.Warning,
            CODE_ORPHAN
          )
        );
      }
    }
    for (const key of scripts.keys) {
      if (!key.name.trimStart().startsWith("//") && !infoNames.has(key.name)) {
        found.push(
          diagnostic(
            document,
            key,
            `No info for "${key.name}" in "scripts-info".`,
            vscode.DiagnosticSeverity.Information,
            CODE_MISSING
          )
        );
      }
    }

    this.diagnostics.set(document.uri, found);
  }

  public clear(uri: vscode.Uri): void {
    this.diagnostics.delete(uri);
  }

  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    return context.diagnostics
      .filter((d) => d.source === SOURCE && d.code === CODE_MISSING)
      .map((d) => {
        const name = document.getText(d.range).replace(/^"|"$/g, "");
        const edit = buildAddInfoEdit(document, name);
        const action = new vscode.CodeAction(
          `Add "${name}" to scripts-info`,
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [d];
        action.isPreferred = true;
        if (edit) {
          action.edit = edit;
        }
        return action;
      })
      .filter((action) => action.edit);
  }

  public dispose(): void {
    this.diagnostics.dispose();
  }
}

export function isPackageJson(uri: vscode.Uri): boolean {
  return uri.path.endsWith("/package.json");
}

function diagnostic(
  document: vscode.TextDocument,
  key: KeyLocation,
  message: string,
  severity: vscode.DiagnosticSeverity,
  code: string
): vscode.Diagnostic {
  const range = new vscode.Range(document.positionAt(key.start), document.positionAt(key.end));
  const item = new vscode.Diagnostic(range, message, severity);
  item.source = SOURCE;
  item.code = code;
  return item;
}

/** Inserts `"name": ""` as the first entry of "scripts-info", in its indentation. */
function buildAddInfoEdit(document: vscode.TextDocument, name: string): vscode.WorkspaceEdit | undefined {
  const text = document.getText();
  const info = locatePackageJson(text).objects.get("scripts-info");
  if (!info) {
    return undefined;
  }

  const openLine = document.positionAt(info.open).line;
  const parentIndent = document.lineAt(openLine).text.match(/^\s*/)?.[0] ?? "";
  const first = info.keys[0];
  const childIndent = first
    ? document.lineAt(document.positionAt(first.start).line).text.match(/^\s*/)?.[0] ?? `${parentIndent}  `
    : `${parentIndent}  `;
  const entry = `${JSON.stringify(name)}: ""`;

  const edit = new vscode.WorkspaceEdit();
  const at = document.positionAt(info.open + 1);
  edit.insert(
    document.uri,
    at,
    first ? `\n${childIndent}${entry},` : `\n${childIndent}${entry}\n${parentIndent}`
  );
  return edit;
}
