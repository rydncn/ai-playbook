import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closedIssues,
  coverage,
  criteria,
  names,
  sections,
  testCases,
} from "./check-criteria.mjs";

test("criteria are the AC numbers that start the quoted lines", () => {
  const satisfies =
    "AC3. A refund is stored as money in\n- Given a row of -1,234.56\n- Then it is not AC9's income\n\n**AC4.** Totals agree";
  assert.deepEqual(criteria(satisfies), ["AC3", "AC4"]);
});

test("criteria fall back to every AC number when none starts a line", () => {
  assert.deepEqual(criteria("Covers AC1 and AC2, AC1 again"), ["AC1", "AC2"]);
  assert.deepEqual(criteria("_No response_"), []);
  assert.deepEqual(criteria(undefined), []);
});

test("the Satisfies field is read from the issue form", () => {
  const body = "### Satisfies\n\nAC7. Two at once\n\n### Done when\n\n`make`";
  assert.deepEqual(criteria(sections(body)["satisfies"]), ["AC7"]);
});

test("closed issues come from GitHub's closing keywords", () => {
  assert.deepEqual(
    closedIssues("Closes #12. Also fixes: #3, resolves #12, and see #99."),
    [12, 3],
  );
  assert.deepEqual(closedIssues("Refs #4"), []);
  assert.deepEqual(closedIssues(null), []);
});

test("a test names a criterion in any runner's naming, but AC3 isn't AC30", () => {
  assert.ok(names("TestAC3_RefundIsIncome", "AC3"));
  assert.ok(names("tests/test_import.py test_AC3_refund", "AC3"));
  assert.ok(names("import AC3: a refund is stored as money in", "AC3"));
  assert.ok(!names("TestAC30_Other", "AC3"));
  assert.ok(!names("TestMAC3", "AC3"));
  assert.ok(!names("test_ac3_lowercase", "AC3"));
});

const report = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="import">
    <testcase classname="import" name="AC3: a refund &amp; its sign" time="0.01"/>
    <testcase classname="import" name="AC4 totals agree" time="0.01">
      <failure message="expected 2">stack</failure>
    </testcase>
    <testcase classname="import" name='AC5 later'>
      <skipped/>
    </testcase>
    <testcase classname="import" name="AC5 also later"><error message="boom"/></testcase>
    <testcase classname="import" name="parses dates"></testcase>
  </testsuite>
</testsuites>`;

test("test cases are read from JUnit XML with their outcome", () => {
  assert.deepEqual(testCases(report), [
    { name: "import AC3: a refund & its sign", status: "passed" },
    { name: "import AC4 totals agree", status: "failed" },
    { name: "import AC5 later", status: "skipped" },
    { name: "import AC5 also later", status: "failed" },
    { name: "import parses dates", status: "passed" },
  ]);
});

test("go test -json output is read as test cases, subtests included", () => {
  const json = [
    '{"Action":"start","Package":"app/imp"}',
    '{"Action":"run","Package":"app/imp","Test":"TestAC3_Refund"}',
    '{"Action":"output","Package":"app/imp","Test":"TestAC3_Refund","Output":"=== RUN\\n"}',
    '{"Action":"pass","Package":"app/imp","Test":"TestAC3_Refund"}',
    '{"Action":"fail","Package":"app/imp","Test":"TestTotals/AC4_agree"}',
    '{"Action":"skip","Package":"app/imp","Test":"TestAC5"}',
    '{"Action":"pass","Package":"app/imp"}',
    "ok  \tapp/imp\t0.1s",
  ].join("\n");
  assert.deepEqual(testCases(json), [
    { name: "app/imp TestAC3_Refund", status: "passed" },
    { name: "app/imp TestTotals/AC4_agree", status: "failed" },
    { name: "app/imp TestAC5", status: "skipped" },
  ]);
});

test("a criterion with a passing test that names it passes", () => {
  const { problems, rows } = coverage({
    acs: ["AC3"],
    cases: testCases(report),
  });
  assert.deepEqual(problems, []);
  assert.equal(rows[0].passed, 1);
});

test("a criterion no test names fails, naming the criterion", () => {
  const { problems } = coverage({ acs: ["AC6"], cases: testCases(report) });
  assert.deepEqual(problems, ["AC6: no test names it."]);
});

test("a criterion whose tests all failed or were skipped fails", () => {
  const { problems } = coverage({
    acs: ["AC4", "AC5"],
    cases: testCases(report),
  });
  assert.deepEqual(problems, [
    "AC4: no test that names it passed (1 failed, 0 skipped).",
    "AC5: no test that names it passed (1 failed, 1 skipped).",
  ]);
});

test("an empty report fails rather than passing nothing", () => {
  const { problems } = coverage({
    acs: ["AC3"],
    cases: testCases("<testsuites/>"),
  });
  assert.deepEqual(problems, [
    "The test report has no test cases: did the tests run?",
  ]);
});

test("one passing test is enough when another naming the same criterion is skipped", () => {
  const cases = [
    { name: "AC8 happy path", status: "passed" },
    { name: "AC8 slow variant", status: "skipped" },
  ];
  assert.deepEqual(coverage({ acs: ["AC8"], cases }).problems, []);
});
