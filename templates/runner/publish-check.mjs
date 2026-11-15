#!/usr/bin/env node
// The publish check: the deterministic step between the agent's session and
// GitHub. The session builds a slice with a read-only token and hands over
// its commits as a git bundle. This script, run in a job with no model and
// no Claude credentials, decides whether those commits may be pushed:
//
// - nothing under the paths that steer the agent or check its work: the
//   workflows, agent configuration, the check scripts and test runner
//   configuration (FORBIDDEN);
// - for a slice whose issue says two-way, nothing on the one-way paths
//   either (read from the base branch, as the review gate reads them);
// - at least one changed file.
//
// It also writes the pull request body: "Closes #<issue>" first, then the
// session's summary with any closing keywords taken out, so the session
// can't close, or pull criteria from, an issue it wasn't given.
//
// Usage: node publish-check.mjs <base sha> <head sha> <issue number> <body
// file>, inside a checkout of the base branch with the head commits fetched,
// GITHUB_TOKEN and GITHUB_REPOSITORY set. Prints each problem and exits 1;
// on success writes the pull request body to <body file>.pr.md.
// Dependency-free; Node 20 or later.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Paths a slice may never change, whatever its door. */
export const FORBIDDEN = [
  ".github/**",
  ".claude/**",
  ".mcp.json",
  "**/CLAUDE.md",
  "**/AGENTS.md",
  ".devcontainer/**",
  ".gitattributes",
  ".gitmodules",
  ".git/**",
  "scripts/check-*.mjs",
  "scripts/review-gate.mjs",
  "scripts/claim.mjs",
  "scripts/publish-check.mjs",
  "**/playwright.config.*",
  "**/vitest.config.*",
  "**/vitest.workspace.*",
  "**/jest.config.*",
  "**/conftest.py",
  "pytest.ini",
];

/** The one-way paths used when the base branch has no list of its own. */
export const DEFAULT_ONE_WAY = [
  "**/migrations/**",
  "package.json",
  "package-lock.json",
  "go.mod",
  "go.sum",
  "pyproject.toml",
  "uv.lock",
  "**/Dockerfile",
];

/** A glob (`**`, `*`, `?`) as a regular expression over a repository path. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      re += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}(?:/.*)?$`);
}

/** The globs in a one-way paths file: one per line, # for comments. */
export function parsePaths(text) {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/#.*/, "").trim())
      .filter(Boolean)
      // "src/auth/" means the folder: drop the slashes, since a folder name
      // already covers what's inside it.
      .map((l) => l.replace(/^\/|\/$/g, ""))
  );
}

const matching = (files, globs) => {
  const res = globs.map(globToRegExp);
  return files.filter((f) => res.some((re) => re.test(f)));
};

/** The issue form's Door field: "one-way", "two-way", or "". */
export function door(issueBody) {
  const m = /^###\s+Door\s*\n+\s*(.+?)\s*$/im.exec(issueBody ?? "");
  const v = (m?.[1] ?? "").toLowerCase();
  return v === "one-way" || v === "two-way" ? v : "";
}

/** The problems that stop the slice's commits being pushed. */
export function problems({ files, issueDoor, oneWay }) {
  const out = [];
  if (files.length === 0) out.push("The session committed no changes.");
  for (const f of matching(files, FORBIDDEN))
    out.push(
      `${f}: a slice may not change the workflows, agent configuration, checks or test configuration.`,
    );
  if (issueDoor !== "one-way")
    for (const f of matching(files, oneWay))
      out.push(
        `${f}: a one-way path, and the issue says two-way. A person decides whether the slice changes it.`,
      );
  return out;
}

/** The pull request body: the issue it closes, then the session's summary. */
export function prBody(issue, summary) {
  const cleaned = (summary ?? "")
    .replace(
      /\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)(\s*:?\s+)(?=[\w.-]*\/?[\w.-]*#\d|https?:\/\/\S+\/(?:issues|pull)\/\d)/gi,
      "",
    )
    .trim();
  return `Closes #${issue}\n\n${cleaned || "(The session left no summary.)"}\n`;
}

async function main() {
  const [base, head, issue, bodyFile] = process.argv.slice(2);
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const sha = /^[0-9a-f]{40}$/;
  if (
    !sha.test(base ?? "") ||
    !sha.test(head ?? "") ||
    !/^\d+$/.test(issue ?? "") ||
    !token ||
    !repo
  )
    throw new Error(
      "usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node publish-check.mjs <base sha> <head sha> <issue> <body file>",
    );

  // The head must build on the base it was given, not replace it.
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", base, head]);
  } catch {
    throw new Error(`${head} doesn't descend from ${base}.`);
  }
  const files = execFileSync(
    "git",
    ["diff", "--name-only", "-z", "--no-renames", base, head],
    {
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);

  const res = await fetch(
    `https://api.github.com/repos/${repo}/issues/${issue}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub issue #${issue}: ${res.status}`);
  const { body } = await res.json();

  const listFile = ".github/one-way-paths";
  const oneWay = existsSync(listFile)
    ? parsePaths(readFileSync(listFile, "utf8"))
    : DEFAULT_ONE_WAY;

  console.log(
    `Changed files (${files.length}):\n${files.map((f) => `  ${f}`).join("\n")}`,
  );
  const found = problems({ files, issueDoor: door(body), oneWay });
  if (found.length) {
    for (const p of found) console.log(`::error::${p}`);
    process.exit(1);
  }
  const summary = existsSync(bodyFile) ? readFileSync(bodyFile, "utf8") : "";
  writeFileSync(`${bodyFile}.pr.md`, prBody(issue, summary));
  console.log("The slice may be published.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
