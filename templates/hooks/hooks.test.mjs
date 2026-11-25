import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  readFileSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEdit } from "./after-edit.mjs";
import { beforeStop } from "./before-stop.mjs";
import { checkPlugins } from "./check-plugins.mjs";

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
    const full = [path.basename(command), ...args].join(" ");
    const key =
      path.basename(command) === "npm" ? args.at(-1) : path.basename(command);
    return results[full] ?? results[key] ?? { status: 0, output: "" };
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

test("on Windows, after-edit refuses a file name the shell would run, and checks nothing", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  writeFileSync(path.join(dir, "src", "a&calc.ts"), "export {};\n");
  const { calls, exec } = recorder();
  const result = afterEdit(
    { tool_input: { file_path: path.join(dir, "src", "a&calc.ts") } },
    { projectDir: dir, exec, windows: true },
  );
  assert.equal(result.code, 2);
  assert.match(result.stderr, /a&calc\.ts/);
  assert.deepEqual(calls, []);
  const plain = afterEdit(
    { tool_input: { file_path: path.join(dir, "src", "a.ts") } },
    { projectDir: dir, exec, windows: true },
  );
  assert.equal(plain.code, 0);
  assert.equal(calls.length, 2);
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

test("after-edit says an unused name a later step will use can wait", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  const { exec } = recorder({
    eslint: { status: 1, output: "1:1 error 'x' is defined but never used" },
  });
  const result = afterEdit(
    { tool_input: { file_path: "src/a.ts" } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 2);
  assert.match(result.stderr, /later step of this same change will use/);
});

function shellRun(dir, results) {
  const stampDir = mkdtempSync(path.join(tmpdir(), "stamps-"));
  const { calls, exec } = recorder(results);
  const hook = (event, extra = {}) =>
    afterEdit(
      {
        hook_event_name: event,
        tool_name: "Bash",
        session_id: "s1",
        tool_input: { command: "sed -i s/a/b/ src/b.ts" },
        ...extra,
      },
      { projectDir: dir, exec, stampDir },
    );
  return { calls, hook };
}

test("after-edit checks the files a shell command changed, and only those", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  const old = new Date(Date.now() - 60_000);
  utimesSync(path.join(dir, "src", "a.ts"), old, old);
  const { calls, hook } = shellRun(dir, {
    git: { status: 0, output: " M src/a.ts\n?? src/b.ts\n D src/gone.ts\n" },
    eslint: { status: 1, output: "1:1 error no-non-null-assertion" },
  });
  assert.equal(hook("PreToolUse").code, 0);
  writeFileSync(path.join(dir, "src", "b.ts"), "export const b = x!;\n");
  const result = hook("PostToolUse");
  assert.equal(result.code, 2);
  assert.match(result.stderr, /shell command changed files/);
  assert.match(result.stderr, /src[/\\]b\.ts/);
  assert.doesNotMatch(result.stderr, /a\.ts/);
  assert.deepEqual(
    calls.filter((c) => c[0] === "eslint").map((c) => path.basename(c.at(-1))),
    ["b.ts"],
    "the file changed earlier, and the deleted one, aren't checked",
  );
});

test("after-edit checks nothing after a shell command when it saw no start, or nothing changed", () => {
  const dir = project({ bins: ["prettier", "eslint"] });
  const { calls, hook } = shellRun(dir, {
    git: { status: 0, output: " M src/a.ts\n" },
  });
  assert.equal(hook("PostToolUse").code, 0, "no start recorded");
  const old = new Date(Date.now() - 60_000);
  utimesSync(path.join(dir, "src", "a.ts"), old, old);
  hook("PreToolUse");
  assert.equal(hook("PostToolUse").code, 0);
  assert.equal(calls.filter((c) => c[0] === "eslint").length, 0);
  assert.equal(
    hook("PostToolUse", { session_id: undefined }).code,
    0,
    "no session to key the start on",
  );
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

test("before-stop skips a turn when nothing changed since its last passing run", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const results = { git: { status: 0, output: " M src/a.ts\n" } };
  const { calls, exec } = recorder(results);
  const npmRuns = () => calls.filter((c) => c[0] === "npm").length;
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(npmRuns(), 1);
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(npmRuns(), 1, "the same dirty tree isn't checked twice");
  results.git = { status: 0, output: " M src/a.ts\n M src/b.ts\n" };
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(npmRuns(), 2, "a change since then is checked");
});

test("before-stop checks again after a failure, even with nothing new", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const { calls, exec } = recorder({
    git: { status: 0, output: " M src/a.ts\n" },
    typecheck: { status: 2, output: "TS2322" },
  });
  assert.equal(beforeStop({}, { projectDir: dir, exec }).decision, "block");
  assert.equal(beforeStop({}, { projectDir: dir, exec }).decision, "block");
  assert.equal(calls.filter((c) => c[0] === "npm").length, 2);
});

test("before-stop does nothing outside a git repository", () => {
  const dir = project({ scripts: { typecheck: "tsc" }, git: false });
  const { calls, exec } = recorder();
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(calls.length, 0);
});

test("before-stop only warns while a background agent of this session is still working", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const { calls, exec } = recorder({
    git: { status: 0, output: " M src/a.ts\n" },
    typecheck: { status: 2, output: "a test failing on purpose" },
  });
  const working = {
    background_tasks: [
      {
        id: "a1",
        type: "subagent",
        status: "running",
        description: "Task 3: implementer",
      },
    ],
  };
  const result = beforeStop(working, { projectDir: dir, exec });
  assert.equal(result.decision, undefined, "doesn't send Claude back");
  assert.match(result.systemMessage, /1 background agent is still working/);
  assert.match(result.systemMessage, /Task 3: implementer/);
  assert.equal(calls.filter((c) => c[0] === "npm").length, 0);

  const done = beforeStop({ background_tasks: [] }, { projectDir: dir, exec });
  assert.equal(done.decision, "block", "checks once nothing is in flight");
});

test("before-stop still checks while only a background shell runs", () => {
  const dir = project({ scripts: { typecheck: "tsc" } });
  const { exec } = recorder({
    git: { status: 0, output: " M src/a.ts\n" },
    typecheck: { status: 2, output: "TS2322" },
  });
  const input = {
    background_tasks: [
      { id: "b1", type: "shell", status: "running", description: "dev server" },
    ],
  };
  assert.equal(beforeStop(input, { projectDir: dir, exec }).decision, "block");
});

// .claude/checks.json: the project's own commands, for any language.

const goChecks = {
  afterEdit: [
    { extensions: [".go"], run: ["gofmt", "-w", "{file}"], fix: true },
    { extensions: [".go"], run: ["go", "vet", "{dir}"] },
  ],
  beforeStop: [
    { run: ["gofmt", "-l", "."], failOnOutput: true },
    { run: ["go", "vet", "./..."] },
    { run: ["go", "test", "./..."] },
  ],
};

function goProject(checks = goChecks) {
  // npm tools and scripts present too, so a fall back to them would show.
  const dir = project({
    bins: ["prettier", "eslint"],
    scripts: { typecheck: "tsc" },
  });
  mkdirSync(path.join(dir, "internal", "web"), { recursive: true });
  writeFileSync(
    path.join(dir, "internal", "web", "server.go"),
    "package web\n",
  );
  mkdirSync(path.join(dir, ".claude"));
  writeFileSync(
    path.join(dir, ".claude", "checks.json"),
    typeof checks === "string" ? checks : JSON.stringify(checks),
  );
  return dir;
}

test("after-edit runs the project's checks for the edited file's extension, instead of the npm defaults", () => {
  const dir = goProject();
  const { calls, exec } = recorder();
  const file = path.join(dir, "internal", "web", "server.go");
  const result = afterEdit(
    { tool_input: { file_path: file } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [
    ["gofmt", "-w", file],
    ["go", "vet", "./internal/web"],
  ]);
});

test("after-edit reports a failing check with its command, and ignores a failing fix", () => {
  const dir = goProject();
  const { exec } = recorder({
    gofmt: { status: 2, output: "syntax error" },
    "go vet ./internal/web": {
      status: 1,
      output: "server.go:3: unreachable code",
    },
  });
  const file = path.join(dir, "internal", "web", "server.go");
  const result = afterEdit(
    { tool_input: { file_path: file } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 2);
  assert.match(result.stderr, /`go vet \.\/internal\/web`/);
  assert.match(result.stderr, /unreachable code/);
  assert.doesNotMatch(result.stderr, /syntax error/);
});

test("after-edit runs nothing for a file no check covers", () => {
  const dir = goProject();
  const { calls, exec } = recorder();
  const result = afterEdit(
    { tool_input: { file_path: path.join(dir, "notes.txt") } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 0);
  assert.deepEqual(calls, []);
});

test("after-edit says so when checks.json can't be read, rather than checking nothing", () => {
  const dir = goProject("{ not json");
  const { calls, exec } = recorder();
  const result = afterEdit(
    {
      tool_input: { file_path: path.join(dir, "internal", "web", "server.go") },
    },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 2);
  assert.match(result.stderr, /\.claude\/checks\.json/);
  assert.deepEqual(calls, []);
});

test("before-stop runs the project's checks in order and stops at the first that fails", () => {
  const dir = goProject();
  const { calls, exec } = recorder({
    git: { status: 0, output: " M internal/web/server.go\n" },
    "gofmt -l .": { status: 0, output: "internal/web/server.go\n" },
  });
  const result = beforeStop({}, { projectDir: dir, exec });
  assert.equal(result.decision, "block");
  assert.match(result.reason, /`gofmt -l \.`/);
  assert.match(result.reason, /server\.go/);
  assert.deepEqual(
    calls.filter((c) => c[0] !== "git"),
    [["gofmt", "-l", "."]],
  );
});

test("before-stop passes when every configured check passes, and never falls back to npm", () => {
  const dir = goProject();
  const { calls, exec } = recorder({
    git: { status: 0, output: " M internal/web/server.go\n" },
  });
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.deepEqual(
    calls.filter((c) => c[0] !== "git"),
    [
      ["gofmt", "-l", "."],
      ["go", "vet", "./..."],
      ["go", "test", "./..."],
    ],
  );
});

test("before-stop sends Claude back once when checks.json can't be read", () => {
  const dir = goProject({ beforeStop: "not a list" });
  const { exec } = recorder({ git: { status: 0, output: " M a\n" } });
  const result = beforeStop({}, { projectDir: dir, exec });
  assert.equal(result.decision, "block");
  assert.match(result.reason, /\.claude\/checks\.json/);
});

// .claude/playbook.json: the one project file. Its commands are command
// lines, run through the shell; it wins over an older checks.json.

const playbook = {
  playbook: "1.0.0",
  tickets: { source: "github" },
  commands: {
    test: "go test -count=1 ./...",
    lint: "go vet ./...",
    formatCheck: 'test -z "$(gofmt -l .)"',
  },
  afterEdit: [
    { extensions: [".go"], run: ["gofmt", "-w", "{file}"], fix: true },
  ],
};

function playbookProject(config = playbook, { withChecks = false } = {}) {
  const dir = withChecks
    ? goProject()
    : project({ bins: ["prettier", "eslint"] });
  mkdirSync(path.join(dir, "internal", "web"), { recursive: true });
  writeFileSync(
    path.join(dir, "internal", "web", "server.go"),
    "package web\n",
  );
  mkdirSync(path.join(dir, ".claude"), { recursive: true });
  writeFileSync(
    path.join(dir, ".claude", "playbook.json"),
    typeof config === "string" ? config : JSON.stringify(config),
  );
  return dir;
}

// Records each call as the command line it would run.
function shellRecorder(results = {}) {
  const calls = [];
  const exec = (command, args, cwd, options = {}) => {
    const line = options.shell
      ? command
      : [path.basename(command), ...args].join(" ");
    calls.push({ line, shell: options.shell === true });
    return (
      results[line] ??
      results[path.basename(command)] ?? { status: 0, output: "" }
    );
  };
  return { calls, exec };
}

test("before-stop runs playbook.json's commands through the shell, in order, stopping at the first failure", () => {
  const dir = playbookProject(playbook, { withChecks: true });
  const { calls, exec } = shellRecorder({
    git: { status: 0, output: " M internal/web/server.go\n" },
    "go vet ./...": { status: 1, output: "server.go:3: unreachable code" },
  });
  const result = beforeStop({}, { projectDir: dir, exec });
  assert.equal(result.decision, "block");
  assert.match(result.reason, /`go vet \.\/\.\.\.`/);
  assert.deepEqual(
    calls.filter((c) => !c.line.startsWith("git ")),
    [
      { line: 'test -z "$(gofmt -l .)"', shell: true },
      { line: "go vet ./...", shell: true },
    ],
  );
});

test("before-stop passes when every playbook.json command passes, ending with the tests", () => {
  const dir = playbookProject();
  const { calls, exec } = shellRecorder({
    git: { status: 0, output: " M internal/web/server.go\n" },
  });
  assert.equal(beforeStop({}, { projectDir: dir, exec }), null);
  assert.equal(calls.at(-1).line, "go test -count=1 ./...");
});

test("after-edit runs playbook.json's edit checks, instead of checks.json or the npm defaults", () => {
  const dir = playbookProject(playbook, { withChecks: true });
  const { calls, exec } = shellRecorder();
  const file = path.join(dir, "internal", "web", "server.go");
  const result = afterEdit(
    { tool_input: { file_path: file } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 0);
  assert.deepEqual(calls, [{ line: `gofmt -w ${file}`, shell: false }]);
});

test("after-edit keeps the npm defaults when playbook.json has no edit checks", () => {
  const { afterEdit: _, ...noEdit } = playbook;
  const dir = playbookProject(noEdit);
  const { calls, exec } = shellRecorder();
  const result = afterEdit(
    { tool_input: { file_path: path.join(dir, "src", "a.ts") } },
    { projectDir: dir, exec },
  );
  assert.equal(result.code, 0);
  assert.deepEqual(
    calls.map((c) => c.line.split(" ")[0]),
    ["prettier", "eslint"],
  );
});

test("both hooks report a broken playbook.json, naming every problem, rather than checking nothing", () => {
  const dir = playbookProject({
    ...playbook,
    commands: { lint: "x" },
    oneWayPath: [],
  });
  const { exec } = shellRecorder({ git: { status: 0, output: " M a\n" } });
  const stop = beforeStop({}, { projectDir: dir, exec });
  assert.equal(stop.decision, "block");
  assert.match(stop.reason, /playbook\.json/);
  assert.match(stop.reason, /commands\.test/);
  assert.match(stop.reason, /oneWayPath/);
  const edit = afterEdit(
    {
      tool_input: { file_path: path.join(dir, "internal", "web", "server.go") },
    },
    { projectDir: dir, exec },
  );
  assert.equal(edit.code, 2);
  assert.match(edit.stderr, /playbook\.json/);
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

test("before-stop runs playbook.json's command lines through a real shell", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-e2e-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  mkdirSync(path.join(dir, ".claude"));
  writeFileSync(
    path.join(dir, ".claude", "playbook.json"),
    JSON.stringify({
      playbook: "1.0.0",
      tickets: { source: "github" },
      commands: {
        lint: 'node -e "process.exit(0)" && echo lint-ok',
        test: 'node -e "process.exit(3)"',
      },
    }),
  );
  const run = spawnSync("node", [path.join(here, "before-stop.mjs")], {
    input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const output = JSON.parse(run.stdout);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /process\.exit\(3\)/);
});

test("after-edit, run as Claude Code runs it, lints a file a shell command rewrote", () => {
  const dir = project({ git: false });
  spawnSync("git", ["init", "-q"], { cwd: dir });
  mkdirSync(path.join(dir, "node_modules", ".bin"), { recursive: true });
  const eslint = path.join(dir, "node_modules", ".bin", "eslint");
  writeFileSync(eslint, '#!/bin/sh\necho "$1: unused import"\nexit 1\n');
  chmodSync(eslint, 0o755);
  const session = `e2e-${process.pid}-${Date.now()}`;
  const hook = (event) =>
    spawnSync("node", [path.join(here, "after-edit.mjs")], {
      input: JSON.stringify({
        hook_event_name: event,
        tool_name: "Bash",
        session_id: session,
        cwd: dir,
        tool_input: { command: "sed -i ..." },
      }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
  assert.equal(hook("PreToolUse").status, 0);
  writeFileSync(path.join(dir, "src", "a.ts"), "import x from 'y';\n");
  const after = hook("PostToolUse");
  assert.equal(after.status, 2);
  assert.match(after.stderr, /src[/\\]a\.ts/);
  assert.match(after.stderr, /unused import/);
});

test("after-edit exits 0 with no output on input it can't use", () => {
  const run = spawnSync("node", [path.join(here, "after-edit.mjs")], {
    input: "not json",
    encoding: "utf8",
  });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, "");
});

// pre-push: a real git push into a local bare repository.

function pushRepo(scripts) {
  const root = mkdtempSync(path.join(tmpdir(), "hooks-push-"));
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  const git = (cwd, ...args) =>
    spawnSync("git", args, { cwd, encoding: "utf8" });
  git(root, "init", "-q", "--bare", remote);
  git(root, "init", "-q", "-b", "main", work);
  writeFileSync(path.join(work, "package.json"), JSON.stringify({ scripts }));
  mkdirSync(path.join(work, ".claude/hooks"), { recursive: true });
  writeFileSync(
    path.join(work, ".claude/hooks", "pre-push"),
    readFileSync(path.join(here, "pre-push")),
  );
  chmodSync(path.join(work, ".claude/hooks", "pre-push"), 0o755);
  git(work, "config", "core.hooksPath", ".claude/hooks");
  git(work, "add", "-A");
  git(
    work,
    "-c",
    "user.email=t@example.com",
    "-c",
    "user.name=t",
    "commit",
    "-qm",
    "init",
  );
  git(work, "remote", "add", "origin", remote);
  git(work, "branch", "feature");
  // A push of the feature branch by default; pass other arguments to try
  // other spellings, including ones a permission rule's prefix can't see.
  return (...args) =>
    args.length
      ? git(root, ...args.map((a) => a.replace("WORK", work)))
      : git(work, "push", "-q", "origin", "feature");
}

test("pre-push stops the push when a check fails", () => {
  const push = pushRepo({
    typecheck: 'node -e "process.exit(1)"',
    lint: 'node -e ""',
  });
  const run = push();
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /npm run typecheck` failed/);
});

test("pre-push refuses a push to main or master however the command spells it", () => {
  const push = pushRepo({ lint: 'node -e ""' });
  for (const args of [
    ["-C", "WORK", "push", "-q", "origin", "main"],
    ["-C", "WORK", "push", "-q", "origin", "HEAD:main"],
    ["-C", "WORK", "push", "-q", "origin", "feature:refs/heads/main"],
    [
      "-C",
      "WORK",
      "-c",
      "push.default=current",
      "push",
      "-q",
      "origin",
      "@:master",
    ],
  ]) {
    const run = push(...args);
    assert.notEqual(run.status, 0, args.join(" "));
    assert.match(
      run.stderr,
      /refusing to push to (main|master)/,
      args.join(" "),
    );
  }
});

test("pre-push lets the push through when the checks pass or don't exist", () => {
  assert.equal(pushRepo({ lint: 'node -e ""' })().status, 0);
  assert.equal(pushRepo({})().status, 0);
});

// check-plugins: the SessionStart warning about enabled plugins that aren't installed.

function pluginProject(enabledPlugins) {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-plugins-"));
  if (enabledPlugins) {
    mkdirSync(path.join(dir, ".claude"));
    writeFileSync(
      path.join(dir, ".claude", "settings.json"),
      JSON.stringify({ enabledPlugins }),
    );
  }
  return dir;
}

const listing =
  (...ids) =>
  () => ({ status: 0, output: JSON.stringify(ids.map((id) => ({ id }))) });

test("check-plugins names each enabled plugin that isn't installed", () => {
  const dir = pluginProject({
    "superpowers@ai-playbook": true,
    "break-ui@ai-playbook": true,
    "off@ai-playbook": false,
  });
  const message = checkPlugins({
    projectDir: dir,
    exec: listing("superpowers@ai-playbook"),
  });
  assert.match(
    message,
    /not installed in this session: break-ui@ai-playbook\./,
  );
  assert.doesNotMatch(
    message,
    /superpowers|off@/,
    "installed and disabled plugins aren't listed",
  );
  assert.match(message, /setup script/);
});

test("check-plugins says nothing when every enabled plugin is installed", () => {
  const dir = pluginProject({ "superpowers@ai-playbook": true });
  assert.equal(
    checkPlugins({
      projectDir: dir,
      exec: listing("superpowers@ai-playbook", "other@x"),
    }),
    null,
  );
});

test("check-plugins says nothing for a project that enables no plugins, without running claude", () => {
  let ran = false;
  const exec = () => {
    ran = true;
    return { status: 0, output: "[]" };
  };
  assert.equal(checkPlugins({ projectDir: pluginProject(), exec }), null);
  assert.equal(checkPlugins({ projectDir: pluginProject({}), exec }), null);
  assert.equal(ran, false);
});

test("check-plugins says it couldn't check when the plugin list fails, rather than staying quiet", () => {
  const dir = pluginProject({ "superpowers@ai-playbook": true });
  for (const exec of [
    () => ({ status: 1, output: "[]" }),
    () => ({ status: 0, output: "not json" }),
  ]) {
    assert.match(
      checkPlugins({ projectDir: dir, exec }),
      /Couldn't check.*superpowers@ai-playbook/,
    );
  }
});

test("check-plugins runs as a hook: prints the warning and exits 0", () => {
  const dir = pluginProject({ "missing@ai-playbook": true });
  const bin = mkdtempSync(path.join(tmpdir(), "hooks-bin-"));
  writeFileSync(path.join(bin, "claude"), "#!/bin/sh\necho '[]'\n");
  chmodSync(path.join(bin, "claude"), 0o755);
  const run = spawnSync("node", [path.join(here, "check-plugins.mjs")], {
    input: JSON.stringify({
      hook_event_name: "SessionStart",
      source: "startup",
    }),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: dir,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /missing@ai-playbook/);
});
