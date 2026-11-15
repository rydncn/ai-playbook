import { test } from "node:test";
import assert from "node:assert/strict";
import { blockers, field, problems, sections, tasks } from "./check-ticket.mjs";

// An issue body as GitHub writes it from the slice form.
const issue = (over = {}) => {
  const s = {
    Satisfies: "AC3. A refund is stored as money in\n- Given …",
    "Design sections": "Shape; Lifecycles: import",
    Tasks:
      "#### Task 1: refunds are money in\n\n- **Test:** `test_refund_is_income` fails on the sign\n- **Code:** parse the sign\n- **Observed by:** the test passing",
    "Done when": "`uv run pytest -k AC3`",
    Door: "Two-way",
    "One-way files": "_No response_",
    "Blocked by": "None",
    ...over,
  };
  return Object.entries(s)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `### ${k}\n\n${v}`)
    .join("\n\n");
};

test("sections are read from the form's headings", () => {
  const s = sections(issue());
  assert.equal(s["door"], "Two-way");
  assert.equal(s["blocked by"], "None");
  assert.match(s["tasks"], /^#### Task 1/);
});

test("tasks split on their headings; a field's placeholder counts as empty", () => {
  const t = tasks(
    "#### Task 1: a\n- **Test:** x\n#### Task 2: b\n- **Test:** <the failing test>",
  );
  assert.deepEqual(
    t.map((x) => x.title),
    ["Task 1: a", "Task 2: b"],
  );
  assert.equal(field(t[0].text, "Test"), "x");
  assert.equal(field(t[1].text, "Test"), "");
  assert.equal(field(t[1].text, "Observed by"), null);
});

test("blockers are read as issue numbers; none and no response are empty", () => {
  assert.deepEqual(blockers("#12, #14"), [12, 14]);
  assert.deepEqual(blockers("None"), []);
  assert.deepEqual(blockers("_No response_"), []);
});

test("a complete slice with one mode label is ready", () => {
  assert.deepEqual(problems({ body: issue(), labels: ["slice", "afk"] }), []);
});

test("each missing part is named", () => {
  const cases = [
    [{ Satisfies: "the import works" }, /Satisfies/],
    [{ "Design sections": "_No response_" }, /Design sections/],
    [{ Tasks: "do the thing" }, /at least one/],
    [
      { Tasks: "#### Task 1: a\n- **Test:** t\n- **Observed by:** <how>" },
      /Observed by/,
    ],
    [{ Tasks: "#### Task 1: a\n- **Observed by:** it passes" }, /failing test/],
    [{ "Done when": "_No response_" }, /Done when/],
    [{ Door: "_No response_" }, /Door/],
    [{ Door: "One-way" }, /One-way files/],
    [{ "Blocked by": undefined }, /Blocked by/],
  ];
  for (const [over, re] of cases) {
    const found = problems({ body: issue(over), labels: ["afk"] });
    assert.equal(found.length, 1, JSON.stringify([over, found]));
    assert.match(found[0], re);
  }
});

test("exactly one of afk and hitl", () => {
  for (const labels of [["slice"], ["afk", "hitl"]])
    assert.match(problems({ body: issue(), labels }).join("\n"), /exactly one/);
  assert.deepEqual(problems({ body: issue(), labels: ["HITL"] }), []);
});

test("a one-way door with its files listed is ready", () => {
  const body = issue({ Door: "One-way", "One-way files": "db/migrations/" });
  assert.deepEqual(problems({ body, labels: ["hitl"] }), []);
});

test("an open blocker stops it", () => {
  const found = problems({
    body: issue({ "Blocked by": "#12" }),
    labels: ["afk"],
    openBlockers: [12],
  });
  assert.deepEqual(found, ["Blocked by #12, which is still open."]);
});

test("a spike needs Measure, Record and Decides instead of a test", () => {
  const spike =
    "#### Task 1: how fast\n- **Measure:** import time for 1 MB\n- **Record:** docs/spikes/1.md\n- **Decides:** the streaming threshold";
  assert.deepEqual(
    problems({ body: issue({ Tasks: spike }), labels: ["afk"] }),
    [],
  );
  const partial = "#### Task 1: how fast\n- **Measure:** import time";
  assert.equal(
    problems({ body: issue({ Tasks: partial }), labels: ["afk"] }).length,
    2,
  );
});

test("the form's labels are the sections the check reads, and its starting text isn't ready", async () => {
  const { readFileSync } = await import("node:fs");
  const form = readFileSync(new URL("./slice.yml", import.meta.url), "utf8");
  const labels = [...form.matchAll(/^\s+label: (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(labels, [
    "Satisfies",
    "Design sections",
    "Tasks",
    "Done when",
    "Door",
    "One-way files",
    "Blocked by",
  ]);
  const start = /value: \|\n([\s\S]*?)\n\s+validations/
    .exec(form)[1]
    .replace(/^ {8}/gm, "");
  const found = problems({ body: issue({ Tasks: start }), labels: ["afk"] });
  assert.equal(found.length, 2, found.join("\n"));
});
