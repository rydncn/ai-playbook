import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterEdit } from "./after-edit.mjs";
import { beforeStop } from "./before-stop.mjs";
import { checkPlugins } from "./check-plugins.mjs";
import { contextSizes, checkBudget } from "./context-budget.mjs";

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

// context-budget: the warning when a session's context grows past its budget.

const row = (value) => JSON.stringify(value);
const assistant = (tokens, extra = {}) =>
  row({
    type: "assistant",
    isSidechain: false,
    message: {
      usage: {
        input_tokens: 2,
        cache_read_input_tokens: tokens - 1002,
        cache_creation_input_tokens: 500,
        output_tokens: 500,
      },
    },
    ...extra,
  });

test("context-budget reads the size at the session's first and last main-thread replies", () => {
  const transcript = [
    row({ type: "user", message: { content: "start" } }),
    assistant(300_000, { isSidechain: true }),
    assistant(50_000),
    assistant(120_000),
    assistant(400_000, { isSidechain: true }),
    row({ type: "user", message: { content: "next" } }),
    "not json",
    "",
  ].join("\n");
  assert.deepEqual(contextSizes(transcript), { start: 50_000, last: 120_000 });
});

test("context-budget starts counting again after a compaction", () => {
  const transcript = [
    assistant(40_000),
    assistant(620_000),
    row({ type: "system", subtype: "compact_boundary" }),
    row({ type: "user", isCompactSummary: true }),
    assistant(126_000),
    assistant(285_000),
  ].join("\n");
  assert.deepEqual(contextSizes(transcript), { start: 126_000, last: 285_000 });
});

test("context-budget finds no size in a transcript with no replies", () => {
  assert.deepEqual(contextSizes(row({ type: "user" })), {
    start: null,
    last: null,
  });
  assert.deepEqual(contextSizes(""), { start: null, last: null });
});

test("context-budget measures what the session added, not what it started with", () => {
  const budget = 100_000;
  assert.deepEqual(
    checkBudget({ tokens: 175_000, start: 80_000, budget, warnedAt: null }),
    { message: null, warnedAt: null },
    "80k of harness instructions plus 95k of work is under budget",
  );
  const over = checkBudget({
    tokens: 185_000,
    start: 80_000,
    budget,
    warnedAt: null,
  });
  assert.match(over.message, /about 185,000 tokens of context/);
  assert.match(over.message, /105,000 of them added since the session started/);
  assert.match(over.message, /budget of 100,000/);
  assert.match(over.message, /\/handoff/);
});

test("context-budget warns once when the budget is passed, again every 50,000 tokens, and again after the context shrinks", () => {
  const budget = 100_000;
  const start = 10_000;
  assert.deepEqual(
    checkBudget({ tokens: 109_999, start, budget, warnedAt: null }),
    { message: null, warnedAt: null },
  );

  const first = checkBudget({ tokens: 122_000, start, budget, warnedAt: null });
  assert.match(first.message, /about 122,000 tokens/);
  assert.equal(first.warnedAt, 100_000);

  assert.deepEqual(
    checkBudget({ tokens: 159_999, start, budget, warnedAt: 100_000 }),
    { message: null, warnedAt: 100_000 },
    "no repeat inside the same 50,000",
  );
  const next = checkBudget({
    tokens: 161_000,
    start,
    budget,
    warnedAt: 100_000,
  });
  assert.match(next.message, /about 161,000 tokens/);
  assert.equal(next.warnedAt, 150_000);

  assert.deepEqual(
    checkBudget({ tokens: 40_000, start, budget, warnedAt: 150_000 }),
    { message: null, warnedAt: null },
    "a compacted or cleared session starts again",
  );
});

function budgetRun(transcriptRows, env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-budget-"));
  const transcript = path.join(dir, "session.jsonl");
  writeFileSync(transcript, transcriptRows.join("\n") + "\n");
  return () =>
    spawnSync("node", [path.join(here, "context-budget.mjs")], {
      input: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "s1",
        transcript_path: transcript,
        prompt: "carry on",
      }),
      env: { ...process.env, CONTEXT_BUDGET_STATE_DIR: dir, ...env },
      encoding: "utf8",
    });
}

test("context-budget runs as a hook: tells Claude and the user once, then stays quiet", () => {
  const run = budgetRun([assistant(20_000), assistant(130_000)]);
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const output = JSON.parse(first.stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /130,000/);
  assert.match(output.systemMessage, /130k tokens, 110k added this session/);

  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, "");
});

test("context-budget stays quiet under the budget, and reads the budget from the environment", () => {
  const under = budgetRun([assistant(80_000), assistant(170_000)])();
  assert.equal(under.status, 0, under.stderr);
  assert.equal(under.stdout, "");

  const lower = budgetRun([assistant(80_000), assistant(170_000)], {
    CLAUDE_CONTEXT_BUDGET: "80000",
  })();
  assert.match(JSON.parse(lower.stdout).systemMessage, /past the 80k budget/);
});

test("context-budget reads a transcript in pieces exactly as it reads it whole", () => {
  const rows = [
    assistant(40_000),
    assistant(90_000),
    row({ type: "system", subtype: "compact_boundary" }),
    assistant(30_000),
    assistant(70_000),
    row({ type: "system", subtype: "compact_boundary" }),
    assistant(25_000),
    assistant(160_000),
  ];
  const whole = contextSizes(rows.join("\n"));
  for (let cut = 1; cut < rows.length; cut++) {
    const first = contextSizes(rows.slice(0, cut).join("\n"));
    const both = contextSizes(rows.slice(cut).join("\n"), first);
    assert.deepEqual(both, whole, `cut after row ${cut}`);
  }
});

function growing(env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "hooks-budget-"));
  const transcript = path.join(dir, "session.jsonl");
  writeFileSync(transcript, "");
  const run = (event = "PostToolUse") =>
    spawnSync("node", [path.join(here, "context-budget.mjs")], {
      input: JSON.stringify({
        hook_event_name: event,
        session_id: "s2",
        transcript_path: transcript,
      }),
      env: { ...process.env, CONTEXT_BUDGET_STATE_DIR: dir, ...env },
      encoding: "utf8",
    });
  const append = (text) => appendFileSync(transcript, text);
  const replace = (text) => writeFileSync(transcript, text);
  const offset = () =>
    JSON.parse(
      readFileSync(path.join(dir, "claude-context-budget-s2.json"), "utf8"),
    ).offset;
  return { run, append, replace, offset };
}

test("context-budget warns during a long turn, after a tool call, naming that event", () => {
  const { run, append } = growing();
  append(assistant(20_000) + "\n");
  assert.equal(run().stdout, "", "under budget");
  append(assistant(90_000) + "\n" + assistant(130_000) + "\n");
  const output = JSON.parse(run().stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(
    output.hookSpecificOutput.additionalContext,
    /110,000 of them added/,
  );
  assert.equal(run().stdout, "", "once per step");
});

test("context-budget leaves a half-written last line until it is complete", () => {
  const { run, append, offset } = growing();
  append(assistant(20_000) + "\n");
  run();
  const line = assistant(150_000);
  const complete = Buffer.byteLength(assistant(20_000) + "\n");
  append(line.slice(0, 40));
  assert.equal(run().stdout, "");
  assert.equal(
    offset(),
    complete,
    "reads on from the last complete line next time",
  );
  append(line.slice(40) + "\n");
  assert.match(
    JSON.parse(run().stdout).systemMessage,
    /150k tokens, 130k added/,
  );
});

test("context-budget starts again when the transcript is replaced by a shorter one", () => {
  const { run, append, replace } = growing();
  append(assistant(20_000) + "\n" + assistant(60_000) + "\n");
  run();
  replace(assistant(10_000) + "\n");
  assert.equal(run().stdout, "");
  append(assistant(115_000) + "\n");
  assert.match(JSON.parse(run().stdout).systemMessage, /105k added/);
});

test("context-budget never fails the prompt, even with no transcript", () => {
  const run = spawnSync("node", [path.join(here, "context-budget.mjs")], {
    input: JSON.stringify({ transcript_path: "/nonexistent/x.jsonl" }),
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, "");
});
