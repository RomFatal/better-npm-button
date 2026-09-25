# Writing `"scripts-info"` for a project

Instructions for an AI assistant. Add a `"scripts-info"` block to this
project's `package.json` that describes every npm script. The Better Npm
Button extension for VS Code shows it in its Run sidebar: a description
beside each script, an environment icon, groups by stage, and a
confirmation before risky scripts.

## The format

`"scripts-info"` is a top-level object in `package.json`, placed right
after `"scripts"`, with one entry per script, keyed by the exact script
name. npm, pnpm, yarn and bun ignore it, so it changes nothing about how
scripts run.

Each entry is an object:

```json
"scripts-info": {
  "dev": {
    "description": "Run the app with hot reload.",
    "env": "local server",
    "stage": "develop"
  }
}
```

| Field | Required | What it's for |
|---|---|---|
| `description` | yes | What the script does, in one short sentence. Shown beside the script name and on hover. |
| `stage` | yes | The step of the workflow it belongs to. The sidebar groups scripts by it. |
| `env` | when the script talks to a server or builds something that will | Which server it hits. Words in it pick an icon. |
| `confirm` | only for risky scripts | Makes the sidebar ask before running. `true`, or the warning to show. |
| any other field | no | Shown on hover as its own labelled line, e.g. `"requires": "Docker running"` → **Requires:** Docker running. |

A plain string (`"lint": "Check code style."`) also works, but use
objects so every entry can have a `stage`.

## Rules

### Coverage

- Describe **every** script in `"scripts"`, including lifecycle ones like
  `postinstall` or `prepare`. The extension flags scripts without info.
- Don't add entries for scripts that don't exist. The extension flags those
  too.
- Skip keys that start with `//`: they are section headers, not scripts.
- Keep the entries in the same order as `"scripts"`.

### `description`

- Say what the script **does** and what it's **for**, not how it's
  implemented. "Run the unit tests once." Not "Runs vitest run."
- Start with a verb. Write a sentence, and end it with a period.
- Aim for about 50 characters; stay under about 100. The sidebar is narrow,
  and the full text shows on hover.
- Add the one caveat someone must know before running it: "Deletes the
  local database.", "Needs Docker running.", "Never uploads anything."
- Don't repeat the stage or the env in the description; they have their
  own fields.

### `stage`

Use these names, in this order of workflow, so the sidebar shows matching
icons:

| Stage | Icon | For |
|---|---|---|
| `develop` | flame | running the app locally, dev servers, watch builds, quick builds |
| `check` | beaker | tests, lint, type checks, formatting checks, end-to-end tests |
| `package` | package | production builds, bundling, installers, Docker images |
| `release` | rocket | publishing, deploying, uploading, tagging a release |
| `maintain` | tools | cleaning, updating dependencies, setup, lifecycle hooks, help |
| `docs` | book | building or serving documentation |
| `db` | database | migrations, seeding, database resets |

- Pick the stage from what the script is used for, not its name. `build`
  that makes a production bundle is `package`; `build:watch` used while
  coding is `develop`.
- Other names are allowed but get a generic icon; use them only when none
  of these fit.
- Groups appear in the order their stage first appears in `"scripts"`. If
  the first script is housekeeping (like `help`), the "maintain" group
  comes first; consider moving such scripts to the end of `"scripts"`.

### `env`

- Set it for every script that runs the app, builds it, or calls a server.
  Leave it out for scripts that don't touch one (lint, unit tests,
  cleaning).
- Use `"prod server"` or `"local server"` when those are accurate. The
  extension looks for whole words:
  - `prod`, `production`, `live` → red cloud icon
  - `local`, `localhost`, `dev`, `development` → green computer icon
  - anything else (e.g. `"staging server"`) → no icon, but still shown on
    hover
- **Find out, don't guess.** Read what the script runs and which env file
  or config it loads (`.env.development`, `.env.production`,
  `--mode staging`, `NODE_ENV`, API URL variables). Production builds and
  packaged apps usually use production settings even when run locally; say
  so. If two parts of the app use different servers, describe what really
  happens rather than simplifying.
- If you can't determine it, leave `env` out and say so to the user.

### `confirm`

- Only for scripts where an accidental click is costly: publishing to users,
  deploying to production, deleting data, resetting a database, force
  pushes.
- Prefer a string that says the consequence: `"Publishes a new version to
  every user."`. `true` shows a generic question.
- Don't add it to ordinary scripts; the sidebar would ask every time.

## Procedure

1. Read `package.json`: the `"scripts"` and the project's package manager.
2. For each script, open what it calls (shell scripts, config files, env
   files, tool configs) enough to know what it really does, what it
   produces, and which server it talks to.
3. Write one entry per script following the rules above.
4. Insert `"scripts-info"` directly after `"scripts"`, keeping the file's
   indentation and key order otherwise untouched. The result must be valid
   JSON.
5. Report to the user: anything you couldn't determine, any `confirm` you
   added and why, and any script that looks broken or surprising (for
   example, a "staging" script that actually talks to production).

## Example: a web app

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "db:migrate": "prisma migrate deploy",
  "db:reset": "prisma migrate reset --force",
  "deploy": "vercel deploy --prod",
  "clean": "rm -rf dist"
},
"scripts-info": {
  "dev": {
    "description": "Run the app with hot reload.",
    "env": "local server",
    "stage": "develop"
  },
  "build": {
    "description": "Production build into dist/.",
    "env": "prod server",
    "stage": "package"
  },
  "preview": {
    "description": "Serve the production build locally.",
    "env": "prod server",
    "stage": "develop"
  },
  "test": {
    "description": "Run the unit tests once.",
    "stage": "check"
  },
  "test:watch": {
    "description": "Re-run the unit tests on every save.",
    "stage": "check"
  },
  "lint": {
    "description": "Check code style with ESLint.",
    "stage": "check"
  },
  "db:migrate": {
    "description": "Apply pending database migrations.",
    "env": "local server",
    "stage": "db"
  },
  "db:reset": {
    "description": "Drop and recreate the local database. Deletes all data.",
    "env": "local server",
    "stage": "db",
    "confirm": "Deletes all data in the local database."
  },
  "deploy": {
    "description": "Deploy to production on Vercel.",
    "env": "prod server",
    "stage": "release",
    "confirm": "Deploys to the live site."
  },
  "clean": {
    "description": "Delete the dist/ folder.",
    "stage": "maintain"
  }
}
```

## Example: a desktop app (Electron)

```json
"scripts-info": {
  "dev": {
    "description": "Run the app with hot reload.",
    "env": "local server",
    "stage": "develop"
  },
  "build:fast": {
    "description": "Production build without obfuscation, in seconds. For quick checks.",
    "env": "prod server",
    "stage": "develop"
  },
  "verify": {
    "description": "Type-check, lint and test. Run before committing.",
    "stage": "check"
  },
  "e2e:payment": {
    "description": "End-to-end purchase test against the local server.",
    "env": "local server",
    "stage": "check",
    "requires": "Core-Server running in Docker"
  },
  "package:test": {
    "description": "Quick signed Mac build for testing. Never uploads.",
    "env": "prod server",
    "stage": "package"
  },
  "package:all": {
    "description": "Installers for Mac, Windows and Linux. Never uploads.",
    "env": "prod server",
    "stage": "package"
  },
  "release": {
    "description": "Bump the version, build everything and publish it.",
    "env": "prod server",
    "stage": "release",
    "confirm": "Publishes a new version to every user."
  },
  "postinstall": {
    "description": "Runs by itself after npm install: rebuilds native modules.",
    "stage": "maintain"
  }
}
```

## Example: a library in a monorepo

Each package has its own `"scripts-info"` in its own `package.json`.

```json
"scripts-info": {
  "build": {
    "description": "Compile to dist/ for publishing.",
    "stage": "package"
  },
  "test": {
    "description": "Run the unit tests once.",
    "stage": "check"
  },
  "docs": {
    "description": "Generate the API reference into docs/.",
    "stage": "docs"
  },
  "publish:npm": {
    "description": "Publish this package to npm.",
    "stage": "release",
    "confirm": "Publishes a new version to the npm registry."
  }
}
```
