import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEdit } from "./after-edit.mjs";
import { beforeStop } from "./before-stop.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function project({ bins = [], scripts = {}, git = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-"));
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(path.join(dir, "notes.txt"), "hello\n");
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts }));
  if (bins.length) {
    mkdirSync(path.join(dir, "node_modules", ".bin"), { recursive: true });
    for (const name of bins) {
      const file = path.join(dir, "node_modules", ".bin", name);
      writeFileSync(file, "#!/bin/sh\nexit 0\n");
      chmodSync(file, 0o755);
    }
  }
  if (git) mkdirSync(path.join(dir, ".git"));
  return dir;
}

function recorder(results = {}) {
  const calls = [];
  const exec = (command, args) => {
    calls.push([path.basename(command), ...args]);
    const key =
      path.basename(command) === "npm" ? args.at(-1) : path.basename(command);
    return results[key] ?? { status: 0, output: "" };
  };
  return { calls, exec };
}

// after-edit

test("after-edit formats and lints an edited TypeScript file", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  const { calls, exec } = recorder();
  const result = afterEdit(
    { tool_input: { file_path: path.join(dir, "src/a.ts") } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 0);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["prettier", "eslint"],
  );
});

test("after-edit reports lint errors to Claude with exit 2", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  const { exec } = recorder({
    eslint: { status: 1, output: "1:1 error no-explicit-any" },
  });
  const result = afterEdit(
    { tool_input: { file_path: "src/a.ts" } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 2);
  assert.match(result.stderr, /src[/\\]a\.ts/);
  assert.match(result.stderr, /no-explicit-any/);
});

test("after-edit skips tools the project hasn't installed", () => {
  const dir = project();
  const { calls, exec } = recorder();
  assert.equal(
    afterEdit(
      { tool_input: { file_path: "src/a.ts" } },
      { projectDir: dir, exec },
    ).code,
    0,
  );
  assert.equal(calls.length, 0);
});

test("after-edit ignores files outside the project, in node_modules, or of other types", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  const outside = project();
  writeFileSync(path.join(dir, "node_modules", "dep.ts"), "export {};\n");
  const { calls, exec } = recorder();
  const paths = [
    path.join(outside, "src", "a.ts"),
    "/etc/hosts",
    "node_modules/dep.ts",
    "notes.txt",
    "",
  ];
  for (const file_path of paths) {
    assert.equal(
      afterEdit({ tool_input: { file_path } }, { projectDir: dir, exec }).code,
      0,
    );
  }
  assert.deepEqual(calls, []);
});

// before-stop

test("before-stop sends Claude back when a check fails after changes", () => {
  const dir = project({
    scripts: { typecheck: "tsc", "test:changed": "vitest run --changed" },
  });
  const { calls, exec } = recorder({
    git: { status: 0, output: " M src/a.ts\n" },
    typecheck: { status: 2, output: "src/a.ts(1,1): error TS2322" },
  });
  const result = beforeStop({}, { projectDir: dir, exec });
  assert.equal(result.decision, "block");
  assert.match(result.reason, /npm run typecheck/);
  assert.match(result.reason, /TS2322/);
  assert.ok(
    !calls.some((c) => c.includes("test:changed")),
    "stops at the first failing check",
  );
});

test("before-stop passes when every check passes, skipping scripts the project lacks", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const { calls, exec } = recorder({
    git: { status: 0, output: " M src/a.ts\n" },
  });
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.deepEqual(
    calls.filter((c) => c[0] === "npm").map((c) => c.at(-1)),
    ["typecheck"],
  );
});

test("before-stop does nothing when no files changed", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const { calls, exec } = recorder({ git: { status: 0, output: "" } });
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(calls.filter((c) => c[0] === "npm").length, 0);
});

test("before-stop lets Claude stop on the second attempt, so it can't loop", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const { calls, exec } = recorder({
    git: { status: 0, output: " M a\n" },
    typecheck: { status: 1, output: "" },
  });
  assert.equal(
    beforeStop({ stop_hook_active: true }, { projectDir: dir, exec }),
    null,
  );
  assert.equal(calls.length, 0);
});

test("before-stop does nothing outside a git repository", () => {
  const dir = project({ scripts: { typecheck: "tsc" }, git: false });
  const { calls, exec } = recorder();
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(calls.length, 0);
});

// End to end: the scripts as Claude Code runs them, reading JSON on stdin.

test("before-stop prints a block decision on stdout and exits 0", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-e2e-"));
  const git = (...args) =>
    spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(3)"' } }),
  );
  const run = spawnSync("node", [path.join(here, "before-stop.mjs")], {
    input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /npm run typecheck/);
});

test("after-edit exits 0 with no output on input it can't use", () => {
  const run = spawnSync("node", [path.join(here, "after-edit.mjs")], {
    input: "not json",
    encoding: "utf8",
  });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, "");
});
