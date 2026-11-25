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
  runCommands,
  stopCommands,
} from "./project-config.mjs";
import { spawnSync } from "node:child_process";

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

test("a misspelt setting names the one it's closest to", () => {
  const found = problems({ ...minimal(), oneWayPath: [] });
  assert.ok(found.some((p) => p.includes('Did you mean "oneWayPaths"?')));
  const command = problems({
    ...minimal(),
    commands: { test: "x", tests: "y" },
  });
  assert.ok(command.some((p) => p.includes('Did you mean "test"?')));
  const far = problems({ ...minimal(), banana: 1 });
  assert.ok(
    far.some((p) => p.includes('"banana"') && !p.includes("Did you mean")),
  );
});

test("a second test tier and a coverage command have their own slots", () => {
  assert.deepEqual(
    problems({
      ...minimal(),
      commands: {
        test: "npm test",
        integration: "npm run test:db",
        coverage: "npx vitest run --coverage",
      },
    }),
    [],
  );
});

test("the second tier and coverage stay out of the stop hook", () => {
  const commands = {
    test: "unit",
    integration: "db",
    coverage: "cov",
    e2e: "e2e",
  };
  assert.deepEqual(stopCommands({ ...minimal(), commands }), ["unit"]);
});

test("running the commands: each once, in order, every one but format", () => {
  const ran = [];
  const exec = (line) => {
    ran.push(line);
    return { status: line === "cov" ? 1 : 0, output: `${line} said this` };
  };
  const config = {
    ...minimal(),
    commands: {
      coverage: "cov",
      format: "fmt",
      test: "unit",
      lint: "lint",
      integration: "db",
    },
  };
  const results = runCommands(config, { exec });
  assert.deepEqual(ran, ["unit", "db", "cov", "lint"]);
  assert.deepEqual(
    results.map((r) => [r.name, r.passed]),
    [
      ["test", true],
      ["integration", true],
      ["coverage", false],
      ["lint", true],
    ],
  );
  assert.equal(results[2].output, "cov said this");
  ran.length = 0;
  runCommands(config, { exec, only: ["lint", "format"] });
  assert.deepEqual(ran, ["lint", "fmt"]);
});

test("run as a script, it runs the file's commands in a real shell and fails when one does", () => {
  const dir = projectWith(
    JSON.stringify({
      ...minimal(),
      commands: {
        test: 'node -e "process.exit(0)"',
        coverage: 'node -e "console.log(42); process.exit(1)"',
      },
    }),
  );
  const script = path.join(here, "project-config.mjs");
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    });
  const all = run();
  assert.equal(all.status, 1);
  assert.match(all.stdout, /pass {2}test/);
  assert.match(all.stdout, /FAIL {2}coverage/);
  assert.match(all.stdout, /42/);
  assert.match(all.stdout, /Not in the file: .*integration/);
  assert.equal(run("test").status, 0);
  assert.equal(run("tests").status, 1);
});
