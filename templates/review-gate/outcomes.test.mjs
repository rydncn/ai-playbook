import { test } from "node:test";
import assert from "node:assert/strict";
import { blamed, group, lastVerdict, outcomes, report } from "./outcomes.mjs";

const repo = "me/app";
const verdictComment = (sha, v) => ({
  user: { login: "github-actions[bot]" },
  body: `<!-- review-gate-verdict ${sha} -->\n\`\`\`json\n${JSON.stringify(v)}\n\`\`\``,
});

test("the last verdict on a pull request is read from the workflow's own comment", () => {
  const comments = [
    verdictComment("aaa111", { must_fix: 1, door: "two-way" }),
    { user: { login: "someone" }, body: "<!-- review-gate-verdict bbb -->{}" },
    verdictComment("ccc333", { must_fix: 0, door: "two-way" }),
  ];
  assert.deepEqual(lastVerdict(comments), { must_fix: 0, door: "two-way" });
  assert.equal(lastVerdict([]), null);
});

test("a pull request is grouped by how the gate let it through", () => {
  const two = { must_fix: 0, door: "two-way" };
  assert.equal(group({ verdict: two, approved: false }), "automated");
  assert.equal(group({ verdict: two, approved: true }), "person");
  assert.equal(
    group({ verdict: { must_fix: 0, door: "one-way" }, approved: true }),
    "person",
  );
  assert.equal(group({ verdict: null, approved: false }), "unreviewed");
  // Merged with the gate red: not counted as automated.
  assert.equal(
    group({ verdict: { must_fix: 2, door: "two-way" }, approved: false }),
    "unreviewed",
  );
});

test("reverts and regressions name what they blame, in GitHub's own wording", () => {
  const b = blamed(
    'Revert "Add export" (#40)\n\nReverts me/app#12\n\nThis reverts commit ABC1234def.\nCaused by #7',
    repo,
  );
  assert.deepEqual([...b.prs].sort(), [12, 7].sort());
  assert.deepEqual([...b.shas], ["abc1234def"]);
  // Another repository's pull request isn't this one's.
  assert.equal(blamed("Reverts other/app#12", repo).prs.size, 0);
});

test("the escape rate is counted per group, by number or by commit", () => {
  const merged = [
    { number: 1, group: "automated", shas: ["1111111aaaa"] },
    { number: 2, group: "automated", shas: ["2222222bbbb"] },
    { number: 3, group: "person", shas: ["3333333cccc"] },
    { number: 4, group: "unreviewed", shas: [] },
  ];
  const r = outcomes({
    merged,
    texts: ["This reverts commit 1111111.", "Caused by #3"],
    repo,
    minSample: 1,
  });
  assert.deepEqual(r.groups.automated, { merged: 2, escaped: [1] });
  assert.deepEqual(r.groups.person, { merged: 1, escaped: [3] });
  assert.deepEqual(r.groups.unreviewed, { merged: 1, escaped: [] });
  assert.equal(r.rate, 0.5);
  assert.equal(r.tripped, true);
});

test("the kill switch waits for enough automated merges, and trips past the limit", () => {
  const many = (n) =>
    Array.from({ length: n }, (_, i) => ({
      number: i + 1,
      group: "automated",
      shas: [],
    }));
  const few = outcomes({ merged: many(5), texts: ["Caused by #1"], repo });
  assert.equal(few.tripped, false);
  assert.match(
    report(few, { days: 90, maxRate: 0.05, minSample: 20 }),
    /Too few/,
  );

  const ok = outcomes({ merged: many(40), texts: ["Caused by #1"], repo });
  assert.equal(ok.tripped, false);
  assert.match(
    report(ok, { days: 90, maxRate: 0.05, minSample: 20 }),
    /^Pass/m,
  );

  const bad = outcomes({
    merged: many(40),
    texts: ["Caused by #1", "Caused by #2", "Caused by #3"],
    repo,
  });
  assert.equal(bad.tripped, true);
  assert.match(
    report(bad, { days: 90, maxRate: 0.05, minSample: 20 }),
    /^Fail: 7\.5% of automated merges escaped/m,
  );
});
