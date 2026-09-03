import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, ".test-build");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

rmSync(outDir, { recursive: true, force: true });

const compile = spawnSync(
  npx,
  ["--no-install", "tsc", "-p", "tsconfig.domain-tests.json"],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "package.json"),
  JSON.stringify({ type: "commonjs" }),
  "utf8",
);

const testsDir = join(outDir, "tests", "domain");
const testFiles = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.js"))
  .map((name) => join(testsDir, name))
  .sort();

if (testFiles.length === 0) {
  throw new Error("No compiled domain tests were found.");
}

const run = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
});

process.exit(run.status ?? 1);
