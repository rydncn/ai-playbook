// Run with: node --test templates/lint-ratchet/check-lint-ratchet.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { countByRule, compare, evaluate } = require("./check-lint-ratchet");

const SCRIPT = path.join(__dirname, "check-lint-ratchet.js");

test("counts findings per rule across files, errors and warnings alike", () => {
  const results = [
    {
      filePath: "a.tsx",
      messages: [
        { ruleId: "react-hooks/set-state-in-effect", severity: 1 },
        { ruleId: "no-console", severity: 1 },
      ],
    },
    {
      filePath: "b.tsx",
      messages: [
        { ruleId: "react-hooks/set-state-in-effect", severity: 2 },
        { ruleId: null, severity: 2 },
      ],
    },
  ];
  assert.deepEqual(countByRule(results), {
    "no-console": 1,
    "parse-error": 1,
    "react-hooks/set-state-in-effect": 2,
  });
});

test("separates rules that got worse from rules that improved", () => {
  const { increases, decreases } = compare(
    { a: 3, b: 2, c: 1 },
    { a: 4, b: 1, d: 1 },
  );
  assert.deepEqual(
    increases.map((i) => i.rule),
    ["a", "d"],
  );
  assert.deepEqual(
    decreases.map((d) => d.rule),
    ["b", "c"],
  );
});

test("fails when a rule's count rises, including a rule the baseline never had", () => {
  assert.equal(evaluate({ ".": { a: 1 } }, { ".": { a: 2 } }).ok, false);
  assert.equal(evaluate({ ".": {} }, { ".": { b: 1 } }).ok, false);
});

test("passes when counts hold or fall, and asks to lock in a fall", () => {
  const result = evaluate({ ".": { a: 5, b: 2 } }, { ".": { a: 5, b: 1 } });
  assert.equal(result.ok, true);
  assert.match(result.lines.join("\n"), /b fell from 2 to 1/);
});

test("fails a target with no baseline rather than passing it", () => {
  const result = evaluate({ ".": { a: 1 } }, { web: { a: 1 } });
  assert.equal(result.ok, false);
  assert.match(result.lines.join("\n"), /no baseline recorded/);
});

test("end to end: record, hold, worsen, improve", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lint-ratchet-"));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  // A stand-in for `npx eslint . --format json` that exits 1, as ESLint does
  // when it finds errors, and reports FAKE_COUNT findings for one rule.
  fs.writeFileSync(
    path.join(bin, "npx"),
    `#!/usr/bin/env node
const n = Number(process.env.FAKE_COUNT || 2);
process.stdout.write(JSON.stringify([{ filePath: "a.tsx", messages: Array(n).fill({ ruleId: "r", severity: 1 }) }]));
process.exit(1);
`,
    { mode: 0o755 },
  );
  const run = (count, ...args) =>
    spawnSync(process.execPath, [SCRIPT, ".", ...args], {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        FAKE_COUNT: String(count),
      },
    });

  assert.equal(run(2).status, 1, "no baseline yet");
  assert.equal(run(2, "--update").status, 0);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(dir, "eslint-baseline.json"), "utf8")),
    { ".": { r: 2 } },
  );
  assert.equal(run(2).status, 0, "unchanged");
  assert.equal(run(3).status, 1, "worse");
  assert.equal(run(1).status, 0, "better");
});
