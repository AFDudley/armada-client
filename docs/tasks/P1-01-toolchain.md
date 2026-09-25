# P1-01 Toolchain and workspace

Depends on: nothing. Read `docs/SPEC.md` §2, §6 first.

## Goal
Install Node 18.20.4 on kelce and create the npm-workspaces skeleton that every other task builds in.

## Deliver
- Node 18.20.4 at `~/.local/node-v18.20.4-linux-x64` on kelce (official tarball from
  `https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz`; verify its SHA-256 against `SHASUMS256.txt` from the
  same directory).
- Repository files:
  - `.nvmrc` containing `18.20.4`.
  - `package.json`: `"private": true`, `"type": "module"`, `"workspaces": ["packages/*", "apps/*"]`,
    `"engines": {"node": "18.20.4"}`, scripts `build` = `tsc -b`, `test` = `node scripts/test.mjs` (lists `packages/*/test/*.test.ts` and `apps/*/test/*.test.ts`, runs them with `node --import tsx --test`, and fails when none exist; Node 18 does not expand globs in `--test` arguments),
    `check` = `npm run build && npm test`. devDependencies: `typescript` 5.x, `tsx` 4.x, `@types/node` 18.x (exact
    versions pinned, no `^`).
  - `tsconfig.base.json`: `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2022"`, `"strict": true`,
    `"declaration": true`, `"composite": true`, `"sourceMap": true`.
  - `tsconfig.json`: solution file with an empty `references` list (packages add themselves).
  - `.gitignore`: `node_modules/`, `dist/`, `*.tsbuildinfo`, `data/`.
  - `package-lock.json` committed.

## Acceptance (run on kelce, paste output)
```sh
export PATH=$HOME/.local/node-v18.20.4-linux-x64/bin:$PATH
node --version        # v18.20.4
npm ci && npm run build && echo BUILD_OK
```

## Out of scope
Any package code. Linting and formatting tools.
