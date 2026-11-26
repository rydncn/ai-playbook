#!/usr/bin/env node
// PostToolUse hook for Edit, Write, MultiEdit and Bash: formats the file that was
// just changed and lints it, so the agent sees problems while it is still
// working on that file rather than at CI time.
//
// The commands come from .claude/playbook.json's "afterEdit", or the older
// .claude/checks.json (any language; see checks.mjs). Without either:
// Prettier and ESLint from the project's node_modules.
//
// Shell edits too: a `sed -i` or a script that rewrites files would otherwise
// reach the commit unchecked. Before each Bash command it notes the time;
// after it, it checks every changed file in git's view that the command
// touched (up to MAX_SHELL_FILES), the same way as an edited one.
//
// Exit 0: nothing to report. Exit 2: a failing check, shown to Claude (the
// edit has already happened; this cannot block it). Tools the project hasn't
// installed are skipped, so the hook never breaks a session.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { failed, fill, loadChecks, shown } from "./checks.mjs";

const FORMAT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".css",
  ".scss",
  ".md",
  ".yml",
  ".yaml",
  ".html",
]);
const LINT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const MAX_OUTPUT = 4000;
const MAX_SHELL_FILES = 20;

// A multi-step change often adds an import before the code that uses it, so
// "unused" mid-change is expected. Said once, here, rather than filtered out:
// an unused import at the end of a change is a real slip.
const FIX_HINT =
  "Fix them before moving on. If one is only a name that a later step of this same change will use, carry on and use it.";

const WINDOWS = process.platform === "win32";

// On Windows the commands run through cmd.exe (it's the only way to start the
// .cmd shims npm installs), and cmd.exe acts on these characters even inside
// an argument. A file named `a&calc.ts` would run `calc`. So a path with any
// of them is refused rather than passed to the shell.
const CMD_SPECIAL = /[&|<>^%!"()`\r\n]/;

// cmd.exe also splits an argument at spaces, so a path with one is quoted.
// It can't hold a quote of its own: CMD_SPECIAL refuses those paths first.
const quoted = (part, windows) =>
  windows && /\s/.test(part) ? `"${part}"` : part;

function defaultExec(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    shell: WINDOWS,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function localBin(projectDir, name) {
  const base = path.join(projectDir, "node_modules", ".bin", name);
  if (existsSync(base)) return base;
  if (WINDOWS && existsSync(`${base}.cmd`)) return `${base}.cmd`;
  return null;
}

export function afterEdit(input, options) {
  if (input?.tool_name === "Bash") return afterShell(input, options);
  return checkFile(input?.tool_input?.file_path, options);
}

/**
 * Before a Bash command (PreToolUse), record when it started; after it
 * (PostToolUse), check the files it changed. One stamp per session and
 * subagent, so agents working side by side don't share one.
 */
function afterShell(input, options) {
  const { projectDir, exec = defaultExec, stampDir = tmpdir() } = options;
  if (typeof input.session_id !== "string") return { code: 0 };
  const key = createHash("sha256")
    .update(`${input.session_id}\0${input.agent_id ?? "main"}\0${projectDir}`)
    .digest("hex")
    .slice(0, 16);
  const stamp = path.join(stampDir, `playbook-shell-${key}`);

  if (input.hook_event_name === "PreToolUse") {
    try {
      writeFileSync(stamp, String(Date.now()));
    } catch {
      // Nothing to compare against afterwards, so nothing is checked.
    }
    return { code: 0 };
  }

  let started;
  try {
    started = Number(readFileSync(stamp, "utf8"));
  } catch {
    return { code: 0 };
  }
  if (!Number.isFinite(started)) return { code: 0 };

  const status = exec(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    projectDir,
  );
  if (status.status !== 0) return { code: 0 };
  const touched = changedPaths(status.output).filter((file) => {
    try {
      // A second of slack for file systems with coarse timestamps.
      return statSync(path.join(projectDir, file)).mtimeMs >= started - 1000;
    } catch {
      return false;
    }
  });

  const reports = [];
  for (const file of touched.slice(0, MAX_SHELL_FILES)) {
    const result = checkFile(file, options);
    if (result.code !== 0) reports.push(result.stderr);
  }
  if (reports.length === 0) return { code: 0 };
  return {
    code: 2,
    stderr: `That shell command changed files the edit checks cover, and they found problems:\n\n${reports.join("\n")}`,
  };
}

/** The paths in `git status --porcelain` output, renamed ones by their new name. */
function changedPaths(porcelain) {
  return porcelain
    .split("\n")
    .filter(
      (line) => line.length > 3 && !line.startsWith("D ") && line[1] !== "D",
    )
    .map((line) => line.slice(3).split(" -> ").at(-1))
    .filter((file) => !file.startsWith('"'));
}

function checkFile(
  filePath,
  { projectDir, exec = defaultExec, windows = WINDOWS },
) {
  if (typeof filePath !== "string" || filePath === "") return { code: 0 };

  const absolute = path.resolve(projectDir, filePath);
  const relative = path.relative(projectDir, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    return { code: 0 };
  if (relative.split(path.sep).includes("node_modules")) return { code: 0 };
  if (!existsSync(absolute)) return { code: 0 };

  if (windows && CMD_SPECIAL.test(absolute)) {
    return {
      code: 2,
      stderr: `${relative} wasn't checked: its path has a character the Windows shell acts on (& | < > ^ % ! " ( ) or a backtick). Rename the file.\n`,
    };
  }

  const extension = path.extname(absolute).toLowerCase();
  const fileArg = quoted(absolute, windows);

  let checks;
  try {
    checks = loadChecks(projectDir);
  } catch (error) {
    return { code: 2, stderr: `${error.message}\n` };
  }
  if (checks?.afterEdit)
    return configured(
      checks.afterEdit,
      extension,
      { file: fileArg, relative, windows },
      projectDir,
      exec,
    );

  const prettier = localBin(projectDir, "prettier");
  if (FORMAT_EXTENSIONS.has(extension) && prettier) {
    exec(
      quoted(prettier, windows),
      ["--write", "--log-level", "warn", "--ignore-unknown", fileArg],
      projectDir,
    );
  }

  const eslint = localBin(projectDir, "eslint");
  if (LINT_EXTENSIONS.has(extension) && eslint) {
    const lint = exec(
      quoted(eslint, windows),
      ["--no-warn-ignored", "--max-warnings", "0", fileArg],
      projectDir,
    );
    if (lint.status !== 0) {
      return {
        code: 2,
        stderr: `ESLint found problems in ${relative}. ${FIX_HINT}\n${lint.output.slice(-MAX_OUTPUT)}`,
      };
    }
  }

  return { code: 0 };
}

function configured(entries, extension, target, projectDir, exec) {
  const { file, relative, windows } = target;
  const dir = path.dirname(relative);
  const vars = {
    file,
    dir:
      dir === "." ? "." : quoted(`./${dir.split(path.sep).join("/")}`, windows),
  };
  for (const entry of entries) {
    if (!entry.extensions.map((e) => e.toLowerCase()).includes(extension))
      continue;
    const [command, ...args] = fill(entry.run, vars);
    const result = exec(command, args, projectDir);
    if (entry.fix !== true && failed(entry, result)) {
      return {
        code: 2,
        stderr: `\`${shown([command, ...args])}\` found problems in ${relative}. ${FIX_HINT}\n${result.output.slice(-MAX_OUTPUT)}`,
      };
    }
  }
  return { code: 0 };
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
  const result = afterEdit(input, { projectDir });
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  main();
