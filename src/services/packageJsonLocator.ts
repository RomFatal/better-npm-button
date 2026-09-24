/**
 * Finds where keys sit in package.json text, which JSON.parse can't tell us:
 * the "Open in package.json" command jumps to a script, and the scripts-info
 * checker needs ranges to underline.
 *
 * A small scanner rather than a JSON library: it only tracks strings and
 * nesting depth, records the keys of the top-level object and of its direct
 * child objects, and gives up quietly (returns what it found) on anything odd.
 */

export interface KeyLocation {
  name: string;
  /** Offset of the opening quote of the key. */
  start: number;
  /** Offset just past the closing quote of the key. */
  end: number;
}

export interface ObjectLocation {
  /** Offset of the object's "{". */
  open: number;
  /** Offset of the object's "}" (or text length if unterminated). */
  close: number;
  keys: KeyLocation[];
}

export interface PackageJsonLayout {
  /** Top-level keys whose value is an object, by name ("scripts", "scripts-info"…). */
  objects: Map<string, ObjectLocation>;
}

export function locatePackageJson(text: string): PackageJsonLayout {
  const objects = new Map<string, ObjectLocation>();
  // Stack of open containers; for objects we remember which top-level key
  // (if any) they are the value of.
  const stack: Array<{ kind: "{" | "["; owner?: string }> = [];
  let pendingKey: KeyLocation | undefined;
  let lastTopKey: string | undefined;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      const start = i;
      i++;
      let value = "";
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") {
          value += text[i + 1] ?? "";
          i += 2;
          continue;
        }
        value += text[i];
        i++;
      }
      const end = i + 1;

      // A string is a key when the next non-space character is ":".
      let j = end;
      while (j < text.length && /\s/.test(text[j])) {
        j++;
      }
      const top = stack[stack.length - 1];
      if (text[j] === ":" && top?.kind === "{") {
        const location = { name: value, start, end };
        if (stack.length === 1) {
          lastTopKey = value;
          pendingKey = location;
        } else if (stack.length === 2 && top.owner) {
          objects.get(top.owner)?.keys.push(location);
        }
      }
      continue;
    }

    if (ch === "{" || ch === "[") {
      // An object that is the direct value of a top-level key.
      const owner =
        ch === "{" && stack.length === 1 && pendingKey && lastTopKey === pendingKey.name
          ? pendingKey.name
          : undefined;
      if (owner) {
        objects.set(owner, { open: i, close: text.length, keys: [] });
      }
      stack.push({ kind: ch, owner });
      pendingKey = undefined;
      continue;
    }

    if (ch === "}" || ch === "]") {
      const closed = stack.pop();
      if (closed?.owner) {
        const location = objects.get(closed.owner);
        if (location) {
          location.close = i;
        }
      }
      continue;
    }

    if (ch === "," && stack.length === 1) {
      pendingKey = undefined;
    }
  }

  return { objects };
}
