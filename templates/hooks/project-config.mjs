// Reads .claude/playbook.json: the one file where a project says what is
// specific to it. Everything else in the playbook (the rules, the hooks, the
// review gate, the criteria and ticket checks) is the same for every project
// and reads its specifics from here, so the playbook works on any stack.
//
// The file runs commands and decides which changes need a person, so it is
// agent configuration and reviewed as code (rule 18). Dependency-free, so it
// runs anywhere Node does, whatever the project's own language.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const CONFIG_FILE = path.join(".claude", "playbook.json");

/** The commands a project can name. Only `test` is required. */
export const COMMANDS = [
  "test", // the whole suite, as CI runs it
  "testChanged", // the tests for what changed, fast enough for every turn
  "e2e", // the end-to-end or acceptance tests, against the real thing
  "lint",
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
    .map((k) => `"${prefix}${k}" isn't a setting the playbook reads.`);
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
  if (
    "oneWayPaths" in config &&
    !(Array.isArray(config.oneWayPaths) && config.oneWayPaths.every(isText))
  ) {
    out.push(
      '"oneWayPaths" is a list of globs, like ["src/auth/", "**/migrations/"].',
    );
  }
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
  const c = config.commands;
  return [c.formatCheck, c.lint, c.typecheck, c.testChanged ?? c.test].filter(
    Boolean,
  );
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
