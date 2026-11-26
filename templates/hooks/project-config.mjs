// Reads .claude/playbook.json: the one file where a project says what is
// specific to it. Everything else in the playbook (the rules, the hooks, the
// review gate, the criteria and ticket checks) is the same for every project
// and reads its specifics from here, so the playbook works on any stack.
//
// The file runs commands and decides which changes need a person, so it is
// agent configuration and reviewed as code (rule 18). Dependency-free, so it
// runs anywhere Node does, whatever the project's own language.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONFIG_FILE = path.join(".claude", "playbook.json");

/** The commands a project can name. Only `test` is required. */
export const COMMANDS = [
  "test", // the whole suite, as CI runs it
  "testChanged", // the tests for what changed, fast enough for every turn
  "integration", // a second test tier: real services the project owns, such as its database
  "e2e", // the end-to-end or acceptance tests, against the real thing
  "coverage", // the suite with the project's coverage threshold enforced
  "lint",
  "lintChanged", // lint for what changed, when the whole-project lint is slow
  "typecheck",
  "format", // fixes formatting across the project
  "formatCheck", // fails when anything is unformatted
];

/** The optional checks a project can turn on. */
export const CHECKS = [
  "review-gate", // the review's verdict as a required check
  "criteria", // every acceptance criterion has a passing test that names it
  "mutation", // mutation testing on the changed files
  "dependency-audit", // the stack's audit, with a dated allowlist
  "rule-check", // written rules as build failures
  "lint-ratchet", // no lint rule's count may rise
];

export const TICKET_SOURCES = ["github", "jira"];

const KEYS = [
  "playbook",
  "tickets",
  "commands",
  "oneWayPaths",
  "knownFailing",
  "checks",
  "afterEdit",
];
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const isObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const JIRA_KEY = /^[A-Z][A-Z0-9_]+$/;
const JIRA_SITE = /^https:\/\/[^/\s]+\/?$/;
const matches = (v, pattern) => typeof v === "string" && pattern.test(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";

function unknownKeys(obj, allowed, prefix) {
  return Object.keys(obj)
    .filter((k) => !allowed.includes(k))
    .map((k) => {
      const near = nearest(k, allowed);
      const hint = near ? ` Did you mean "${near}"?` : "";
      return `"${prefix}${k}" isn't a setting the playbook reads.${hint}`;
    });
}

/** The allowed key within two edits of `key`, ignoring case, if there is one. */
function nearest(key, allowed) {
  let best = null;
  let bestDistance = 3;
  for (const candidate of allowed) {
    const d = distance(key.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) [best, bestDistance] = [candidate, d];
  }
  return best;
}

function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    row = next;
  }
  return row[b.length];
}

function ticketProblems(tickets) {
  if (!isObject(tickets)) {
    return [
      '"tickets" is required: { "source": "github" } or { "source": "jira", ... }.',
    ];
  }
  if (!TICKET_SOURCES.includes(tickets.source)) {
    return [`"tickets.source" is one of ${TICKET_SOURCES.join(", ")}.`];
  }
  if (tickets.source === "github") {
    return unknownKeys(tickets, ["source"], "tickets.");
  }
  const out = unknownKeys(tickets, ["source", "project", "site"], "tickets.");
  if (!matches(tickets.project, JIRA_KEY)) {
    out.push(
      '"tickets.project" is the Jira project key, in capitals, like "KAN".',
    );
  }
  if (!matches(tickets.site, JIRA_SITE)) {
    out.push(
      '"tickets.site" is the Jira site, like "https://example.atlassian.net".',
    );
  }
  return out;
}

function commandProblems(commands) {
  if (!isObject(commands)) {
    return ['"commands" is required, with at least "test".'];
  }
  const out = unknownKeys(commands, COMMANDS, "commands.");
  if (!("test" in commands)) out.push('"commands.test" is required.');
  for (const [name, command] of Object.entries(commands)) {
    if (COMMANDS.includes(name) && !isText(command)) {
      out.push(`"commands.${name}" is a command line, as a non-empty string.`);
    }
  }
  return out;
}

/**
 * Every problem with a config, as sentences that name the setting. An empty
 * list means the config is usable.
 */
export function problems(config) {
  if (!isObject(config)) return ["The file holds one JSON object."];
  const out = unknownKeys(config, KEYS, "");
  if (!(typeof config.playbook === "string" && VERSION.test(config.playbook))) {
    out.push(
      '"playbook" is the release the project is set up against, like "1.0.0".',
    );
  }
  out.push(...ticketProblems(config.tickets));
  out.push(...commandProblems(config.commands));
  if ("oneWayPaths" in config && !validOneWayPaths(config.oneWayPaths)) {
    out.push(
      '"oneWayPaths" is a list of globs, like ["src/auth/", "**/migrations/"], or an object from each glob to why it is one-way.',
    );
  }
  if ("knownFailing" in config) out.push(...knownProblems(config));
  if ("afterEdit" in config && !validEditChecks(config.afterEdit)) {
    out.push(
      '"afterEdit" is a list of { "extensions": [".go"], "run": ["gofmt", "-w", "{file}"] }, with "fix": true for a formatter.',
    );
  }
  if ("checks" in config) {
    if (!Array.isArray(config.checks)) {
      out.push(`"checks" is a list drawn from ${CHECKS.join(", ")}.`);
    } else {
      for (const check of config.checks) {
        if (!CHECKS.includes(check)) {
          out.push(
            `"checks" has "${check}", which isn't one of ${CHECKS.join(", ")}.`,
          );
        }
      }
    }
  }
  return out;
}

function validOneWayPaths(paths) {
  if (Array.isArray(paths)) return paths.every(isText);
  return (
    isObject(paths) &&
    Object.entries(paths).every(([glob, why]) => isText(glob) && isText(why))
  );
}

function knownProblems(config) {
  const known = config.knownFailing;
  const shape =
    '"knownFailing" is an object from a command\'s name to why it fails on this checkout, like { "lint": "CRLF endings; issue #42" }.';
  if (!isObject(known)) return [shape];
  const out = [];
  for (const [name, why] of Object.entries(known)) {
    if (!isObject(config.commands) || !(name in config.commands)) {
      out.push(`"knownFailing.${name}" isn't one of the file's commands.`);
    } else if (!isText(why)) {
      out.push(shape);
    }
  }
  return out;
}

/** The one-way globs, from either form of "oneWayPaths". */
export function oneWayGlobs(config) {
  const paths = config.oneWayPaths ?? [];
  return Array.isArray(paths) ? paths : Object.keys(paths);
}

/**
 * A glob (`**`, `*`, `?`) as a regular expression over a repository path; a
 * trailing slash, or a folder name, covers what's inside it. The same as the
 * review gate's, which a test checks.
 */
export function globToRegExp(glob) {
  const g = glob.replace(/^\/|\/$/g, "");
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*" && g[i + 1] === "*") {
      const slash = g[i + 2] === "/";
      re += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}(?:/.*)?$`);
}

function validEditChecks(entries) {
  return (
    Array.isArray(entries) &&
    entries.every(
      (e) =>
        isObject(e) &&
        Array.isArray(e.run) &&
        e.run.length > 0 &&
        e.run.every(isText) &&
        Array.isArray(e.extensions) &&
        e.extensions.every(isText),
    )
  );
}

/**
 * The commands the stop hook runs, in order: the fast checks, then the tests
 * for what changed, or the whole suite when the project has no such command.
 */
export function stopCommands(config) {
  const known = config.knownFailing ?? {};
  const pick = (...names) =>
    names.map((n) => !(n in known) && config.commands[n]).find(Boolean);
  return [
    pick("formatCheck"),
    pick("lintChanged", "lint"),
    pick("typecheck"),
    pick("testChanged", "test"),
  ].filter(Boolean);
}

/**
 * The project's config, or null when it has none. Throws an Error naming the
 * file and every problem when it exists but can't be used, so a broken file is
 * reported rather than quietly checking nothing (rule 9).
 */
export function loadProjectConfig(projectDir) {
  const file = path.join(projectDir, CONFIG_FILE);
  if (!existsSync(file)) return null;
  let config;
  try {
    config = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${CONFIG_FILE} can't be read: ${error.message}`);
  }
  const found = problems(config);
  if (found.length > 0) {
    throw new Error(`${CONFIG_FILE} has problems:\n- ${found.join("\n- ")}`);
  }
  return config;
}

/** Whether a project on `project` is behind the playbook's `current` release. */
export function isBehind(project, current) {
  const a = project.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * Runs each named command once, in the order of COMMANDS, and returns what
 * happened to each. By default every command but `format`, which rewrites
 * files. Used at setup and after editing the file, so a command that fails on
 * a clean checkout, or a threshold nobody runs, is found then and not weeks
 * later (rule 9).
 */
export function runCommands(
  config,
  { projectDir = process.cwd(), only, exec = shellExec } = {},
) {
  const wanted = only?.length ? only : COMMANDS.filter((n) => n !== "format");
  return COMMANDS.filter(
    (name) => wanted.includes(name) && config.commands[name],
  ).map((name) => {
    const started = Date.now();
    const run = exec(config.commands[name], projectDir);
    return {
      name,
      line: config.commands[name],
      known: config.knownFailing?.[name],
      passed: run.status === 0,
      seconds: Math.round((Date.now() - started) / 1000),
      output: run.output,
    };
  });
}

function shellExec(line, cwd) {
  const result = spawnSync(line, { cwd, shell: true, encoding: "utf8" });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

/** The one-way globs that match no file git tracks; none without git. */
function unmatchedGlobs(config, projectDir) {
  const listed = spawnSync("git", ["ls-files"], {
    cwd: projectDir,
    encoding: "utf8",
  });
  if (listed.status !== 0) return [];
  const files = listed.stdout.split("\n").filter(Boolean);
  return oneWayGlobs(config).filter(
    (glob) => !files.some((f) => globToRegExp(glob).test(f)),
  );
}

function main(args) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let config;
  try {
    config = loadProjectConfig(projectDir);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  if (!config) {
    process.stderr.write(`There is no ${CONFIG_FILE} here.\n`);
    return 1;
  }
  const unknown = args.filter((a) => !COMMANDS.includes(a));
  if (unknown.length > 0) {
    process.stderr.write(
      `Not a command the file can name: ${unknown.join(", ")}. They are ${COMMANDS.join(", ")}.\n`,
    );
    return 1;
  }
  const results = runCommands(config, { projectDir, only: args });
  for (const r of results) {
    if (!r.passed && !r.known)
      process.stdout.write(`\n--- ${r.name} ---\n${r.output.slice(-4000)}\n`);
  }
  process.stdout.write("\n");
  for (const r of results) {
    const label = r.passed ? "pass" : r.known ? "known" : "FAIL";
    const note = !r.known
      ? ""
      : r.passed
        ? " (passes now: take it out of knownFailing)"
        : ` (known failing: ${r.known})`;
    process.stdout.write(
      `${label.padEnd(5)} ${r.name} (${r.seconds}s): ${r.line}${note}\n`,
    );
  }
  const missing = COMMANDS.filter((n) => !config.commands[n]);
  if (missing.length > 0) {
    process.stdout.write(`Not in the file: ${missing.join(", ")}.\n`);
  }
  for (const glob of unmatchedGlobs(config, projectDir)) {
    process.stdout.write(
      `Warning: one-way path "${glob}" matches no file. Check it for a typo.\n`,
    );
  }
  return results.every((r) => r.passed || r.known) ? 0 : 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  process.exit(main(process.argv.slice(2)));
