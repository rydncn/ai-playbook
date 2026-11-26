#!/usr/bin/env node
// Stop hook: before Claude finishes a turn in which it changed files, run the
// fast checks. If one fails, Claude is sent back to fix it, or to tell the
// user plainly that it couldn't, rather than reporting the work as done.
//
// The checks come from .claude/playbook.json's commands, or the older
// .claude/checks.json's "beforeStop" (any language; see checks.mjs), and
// otherwise from the package.json scripts in CHECKS.
//
// While a background subagent or workflow of this session is still running,
// it only warns: the tree holds that agent's work in progress (often a test
// it is deliberately failing), and checking it would send back a session
// that changed nothing. The checks run at the first stop with nothing in
// flight. Claude Code lists that work in the Stop input's background_tasks;
// an older version that doesn't checks every time, as before.
//
// It sends Claude back once per stop. If the checks still fail on the next
// attempt (stop_hook_active is true), it lets Claude stop, so a check that
// cannot be fixed in this session never traps it in a loop.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { failed, loadChecks, shown } from "./checks.mjs";

// The package.json scripts to run, in order. Keep them fast: the type check
// and the unit tests for changed files, not the whole end-to-end suite.
// Scripts the project doesn't have are skipped.
export const CHECKS = ["typecheck", "lint", "test:changed"];
const MAX_OUTPUT = 4000;

// Background work that edits the working tree. A background shell (a dev
// server, a watcher) doesn't hold the checks back.
const AGENT_TASKS = new Set(["subagent", "workflow"]);

function defaultExec(command, args, cwd, { shell = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
    shell: shell || process.platform === "win32",
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function readScripts(projectDir) {
  try {
    return (
      JSON.parse(readFileSync(path.join(projectDir, "package.json"), "utf8"))
        .scripts ?? {}
    );
  } catch {
    return {};
  }
}

export function beforeStop(
  input,
  { projectDir, exec = defaultExec, checks = CHECKS },
) {
  if (input?.stop_hook_active === true) return null;
  if (!existsSync(path.join(projectDir, ".git"))) return null;

  const status = exec("git", ["status", "--porcelain"], projectDir);
  if (status.status !== 0 || status.output.trim() === "") return null;

  const running = agentsRunning(input);
  if (running.length > 0) {
    return {
      systemMessage:
        `Stop checks not run: ${running.length} background ${running.length === 1 ? "agent is" : "agents are"} still working (${running.join("; ")}). ` +
        "They run at the first stop after the last one finishes.",
    };
  }

  // A checkout that is always dirty (line endings, untracked notes) would be
  // checked on every turn. Skip when the tree is exactly as it was at the
  // last run: after a pass, quietly; after a send-back, with a one-line
  // reminder, since the same failure on the same tree needs no second one.
  const state = treeState(projectDir, status.output, exec);
  const stateFile = path.join(projectDir, ".git", "playbook-stop-state");
  const last = state ? readState(stateFile) : null;
  if (last?.tree === state) {
    if (!last.failing) return null;
    return {
      systemMessage: `Stop checks not run: the tree is unchanged since \`${last.failing}\` failed and Claude was sent back for it.`,
    };
  }
  const result = runChecks(projectDir, exec, checks);
  if (state && result === null) saveState(stateFile, state);
  if (state && result?.command) saveState(stateFile, state, result.command);
  if (result) delete result.command;
  return result;
}

/** The background agents of this session still in flight, described. */
function agentsRunning(input) {
  const tasks = Array.isArray(input?.background_tasks)
    ? input.background_tasks
    : [];
  return tasks
    .filter((t) => AGENT_TASKS.has(t?.type))
    .map((t) => String(t.description ?? t.agent_type ?? t.type).slice(0, 80));
}

function runChecks(projectDir, exec, checks) {
  let configured;
  try {
    configured = loadChecks(projectDir);
  } catch (error) {
    return {
      decision: "block",
      reason: `${error.message} Fix it, or tell the user, before finishing.`,
    };
  }
  if (configured) {
    for (const entry of configured.beforeStop) {
      const [command, ...args] = entry.run;
      const run = exec(command, args, projectDir, {
        shell: entry.shell === true,
      });
      if (failed(entry, run)) return blocked(shown(entry.run), run.output);
    }
    return null;
  }

  const scripts = readScripts(projectDir);
  for (const name of checks) {
    if (!scripts[name]) continue;
    const run = exec("npm", ["run", "--silent", name], projectDir);
    if (run.status !== 0) return blocked(`npm run ${name}`, run.output);
  }
  return null;
}

/**
 * A fingerprint of the working tree: what git reports as changed, the diff
 * itself, and each untracked file's size and modification time. Null when
 * git can't say, so nothing is skipped.
 */
function treeState(projectDir, porcelain, exec) {
  const unstaged = exec("git", ["diff", "--no-ext-diff"], projectDir);
  const staged = exec("git", ["diff", "--cached", "--no-ext-diff"], projectDir);
  const untracked = exec(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    projectDir,
  );
  if ([unstaged, staged, untracked].some((r) => r.status !== 0)) return null;
  const hash = createHash("sha256")
    .update(porcelain)
    .update(unstaged.output)
    .update(staged.output);
  for (const file of untracked.output.split("\n").filter(Boolean)) {
    try {
      const { size, mtimeMs } = statSync(path.join(projectDir, file));
      hash.update(`${file}\0${size}\0${mtimeMs}\n`);
    } catch {
      hash.update(`${file}\0gone\n`);
    }
  }
  return hash.digest("hex");
}

/** The last run's tree and, if it sent Claude back, the failing command. */
function readState(file) {
  try {
    const [tree, failing = null] = readFileSync(file, "utf8")
      .trim()
      .split("\n");
    return { tree, failing };
  } catch {
    return null;
  }
}

function saveState(file, tree, failing) {
  try {
    writeFileSync(file, failing ? `${tree}\n${failing}\n` : `${tree}\n`);
  } catch {
    // A worktree's .git is a file, not a folder: nothing is skipped there.
  }
}

function blocked(command, output) {
  return {
    decision: "block",
    command,
    reason:
      `\`${command}\` fails. If your own changes caused it, fix it before finishing. ` +
      `If it is another agent's work in progress, or can't be fixed in this session, leave it ` +
      `and tell the user exactly what fails and why, rather than reporting the work as done.` +
      `\n\n${output.slice(-MAX_OUTPUT)}`,
  };
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);
  }
  const projectDir =
    process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const result = beforeStop(input, { projectDir });
  if (result) process.stdout.write(JSON.stringify(result));
  process.exit(0);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  main();
