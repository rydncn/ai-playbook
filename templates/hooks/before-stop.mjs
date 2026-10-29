#!/usr/bin/env node
// Stop hook: before Claude finishes a turn in which it changed files, run the
// fast checks. If one fails, Claude is sent back to fix it, or to tell the
// user plainly that it couldn't, rather than reporting the work as done.
//
// It sends Claude back once per stop. If the checks still fail on the next
// attempt (stop_hook_active is true), it lets Claude stop, so a check that
// cannot be fixed in this session never traps it in a loop.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The package.json scripts to run, in order. Keep them fast: the type check
// and the unit tests for changed files, not the whole end-to-end suite.
// Scripts the project doesn't have are skipped.
export const CHECKS = ["typecheck", "lint", "test:changed"];
const MAX_OUTPUT = 4000;

function defaultExec(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
    shell: process.platform === "win32",
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

  const scripts = readScripts(projectDir);
  for (const name of checks) {
    if (!scripts[name]) continue;
    const run = exec("npm", ["run", "--silent", name], projectDir);
    if (run.status !== 0) {
      return {
        decision: "block",
        reason:
          `\`npm run ${name}\` fails after your changes. Fix it before finishing. ` +
          `If it can't be fixed in this session, stop and tell the user exactly what fails and why, ` +
          `rather than reporting the work as done.\n\n${run.output.slice(-MAX_OUTPUT)}`,
      };
    }
  }
  return null;
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
