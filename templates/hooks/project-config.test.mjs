import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_FILE,
  isBehind,
  loadProjectConfig,
  problems,
  stopCommands,
} from "./project-config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const minimal = () => ({
  playbook: "1.0.0",
  tickets: { source: "github" },
  commands: { test: "npm test" },
});

const projectWith = (contents) => {
  const dir = mkdtempSync(path.join(tmpdir(), "playbook-config-"));
  if (contents !== undefined) {
    mkdirSync(path.join(dir, ".claude"));
    writeFileSync(path.join(dir, CONFIG_FILE), contents);
  }
  return dir;
};

test("the shipped examples are valid", () => {
  for (const name of [
    "playbook.example.json",
    "examples/go-github.json",
    "examples/node-jira.json",
    "examples/python-github.json",
  ]) {
    const config = JSON.parse(
      readFileSync(path.join(here, "..", "project", name), "utf8"),
    );
    assert.deepEqual(problems(config), [], name);
  }
});

test("a minimal config has no problems", () => {
  assert.deepEqual(problems(minimal()), []);
});

test("the version, the ticket source and the test command are required", () => {
  const found = problems({});
  assert.ok(found.some((p) => p.includes('"playbook"')));
  assert.ok(found.some((p) => p.includes('"tickets"')));
  assert.ok(found.some((p) => p.includes('"commands"')));
  assert.ok(
    problems({ ...minimal(), commands: { lint: "x" } }).some((p) =>
      p.includes('"commands.test"'),
    ),
  );
});

test("the version is a release number, not a commit or a range", () => {
  for (const bad of ["c3ab36e", "^1.0.0", "1.0", "v1.0.0", 1]) {
    assert.ok(
      problems({ ...minimal(), playbook: bad }).some((p) =>
        p.includes('"playbook"'),
      ),
      String(bad),
    );
  }
});

test("Jira needs a project key and a site; GitHub needs neither", () => {
  const jira = (t) => problems({ ...minimal(), tickets: t });
  assert.deepEqual(
    jira({ source: "jira", project: "KAN", site: "https://x.atlassian.net" }),
    [],
  );
  assert.ok(
    jira({ source: "jira" }).some((p) => p.includes("tickets.project")),
  );
  assert.ok(jira({ source: "jira" }).some((p) => p.includes("tickets.site")));
  assert.ok(
    jira({ source: "jira", project: "kan", site: "https://x.atlassian.net" })
      .length > 0,
  );
  assert.ok(
    jira({ source: "jira", project: "KAN", site: "http://x.atlassian.net" })
      .length > 0,
  );
  assert.ok(
    jira({ source: "linear" }).some((p) => p.includes("tickets.source")),
  );
  assert.ok(
    jira({ source: "github", project: "KAN" }).some((p) =>
      p.includes("tickets.project"),
    ),
  );
});

test("commands are non-empty strings", () => {
  const found = problems({
    ...minimal(),
    commands: { test: "", lint: ["eslint", "."] },
  });
  assert.ok(found.some((p) => p.includes('"commands.test"')));
  assert.ok(found.some((p) => p.includes('"commands.lint"')));
});

test("one-way paths are a list of globs", () => {
  assert.deepEqual(
    problems({
      ...minimal(),
      oneWayPaths: ["supabase/migrations/", "app.json"],
    }),
    [],
  );
  assert.ok(problems({ ...minimal(), oneWayPaths: "app.json" }).length > 0);
  assert.ok(problems({ ...minimal(), oneWayPaths: ["", "x"] }).length > 0);
});

test("optional checks are ones the playbook has", () => {
  assert.deepEqual(
    problems({ ...minimal(), checks: ["criteria", "mutation"] }),
    [],
  );
  assert.ok(
    problems({ ...minimal(), checks: ["criterias"] }).some((p) =>
      p.includes("criterias"),
    ),
  );
});

test("a misspelt key is reported rather than silently ignored", () => {
  assert.ok(
    problems({ ...minimal(), oneWayPath: [] }).some((p) =>
      p.includes('"oneWayPath"'),
    ),
  );
  assert.ok(
    problems({ ...minimal(), commands: { test: "x", tests: "y" } }).some((p) =>
      p.includes('"commands.tests"'),
    ),
  );
});

test("every problem is reported at once", () => {
  assert.equal(
    problems({ playbook: "x", tickets: { source: "y" }, commands: {} }).length,
    3,
  );
});

test("loading: no file means no config; a broken file is an error naming it", () => {
  assert.equal(loadProjectConfig(projectWith()), null);
  assert.throws(
    () => loadProjectConfig(projectWith("{ nope")),
    /playbook\.json/,
  );
  assert.throws(
    () => loadProjectConfig(projectWith(JSON.stringify({ playbook: "1.0.0" }))),
    /"tickets"/,
  );
  assert.deepEqual(
    loadProjectConfig(projectWith(JSON.stringify(minimal()))),
    minimal(),
  );
});

test("a project is behind when the playbook has a newer release", () => {
  assert.equal(isBehind("1.0.0", "1.0.0"), false);
  assert.equal(isBehind("1.0.0", "1.0.1"), true);
  assert.equal(isBehind("1.2.0", "1.10.0"), true);
  assert.equal(isBehind("2.0.0", "1.9.9"), false);
});

test("edit checks take the same shape as checks.json's afterEdit", () => {
  const afterEdit = [
    { extensions: [".go"], run: ["gofmt", "-w", "{file}"], fix: true },
  ];
  assert.deepEqual(problems({ ...minimal(), afterEdit }), []);
  assert.ok(
    problems({ ...minimal(), afterEdit: [{ run: ["gofmt"] }] }).some((p) =>
      p.includes('"afterEdit"'),
    ),
  );
  assert.ok(
    problems({
      ...minimal(),
      afterEdit: [{ extensions: [".go"], run: "gofmt" }],
    }).length > 0,
  );
});

test("the stop checks are the fast commands, in order, with the changed tests", () => {
  const config = {
    ...minimal(),
    commands: {
      test: "npm test",
      testChanged: "npx vitest run --changed",
      e2e: "npx playwright test",
      lint: "npm run lint",
      typecheck: "tsc --noEmit",
      format: "prettier --write .",
      formatCheck: "prettier --check .",
    },
  };
  assert.deepEqual(stopCommands(config), [
    "prettier --check .",
    "npm run lint",
    "tsc --noEmit",
    "npx vitest run --changed",
  ]);
});

test("without changed-tests, the stop checks run the whole suite", () => {
  assert.deepEqual(
    stopCommands({
      ...minimal(),
      commands: { test: "go test ./...", lint: "go vet ./..." },
    }),
    ["go vet ./...", "go test ./..."],
  );
});
