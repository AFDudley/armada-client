// Node 18 does not expand globs in `node --test` arguments; list test files here instead.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const files = [];
for (const root of ["packages", "apps"]) {
  if (!existsSync(root)) continue;
  for (const pkg of readdirSync(root)) {
    const dir = join(root, pkg, "test");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".test.ts")) files.push(join(dir, f));
  }
}
if (files.length === 0) {
  console.error("no test files under packages/*/test or apps/*/test");
  process.exit(1);
}
const r = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
