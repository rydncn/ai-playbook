import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAIMED, candidate, pickNext } from "./claim.mjs";

const issue = (number, labels, over = {}) => ({
  number,
  title: `Slice ${number}`,
  state: "open",
  labels: labels.map((name) => ({ name })),
  ...over,
});
const READY = ["slice", "ready", "afk"];

test("a candidate is an open slice labelled ready and afk", () => {
  assert.ok(candidate(issue(1, READY)));
  assert.ok(candidate(issue(1, ["Slice", "Ready", "AFK"])));
  assert.ok(!candidate(issue(1, ["slice", "afk"])), "not ready");
  assert.ok(!candidate(issue(1, ["slice", "ready"])), "no mode");
  assert.ok(!candidate(issue(1, [...READY, "hitl"])), "both modes");
  assert.ok(!candidate(issue(1, [...READY, CLAIMED])), "already claimed");
  assert.ok(!candidate(issue(1, READY, { state: "closed" })));
  assert.ok(
    !candidate(issue(1, READY, { pull_request: {} })),
    "a pull request",
  );
});

test("the oldest candidate that passes the ticket check is claimed", () => {
  const checked = [];
  const { issue: next, skipped } = pickNext(
    [issue(9, READY), issue(4, READY), issue(2, ["slice", "afk"])],
    (n) => {
      checked.push(n);
      return { ok: true, output: "" };
    },
  );
  assert.equal(next.number, 4);
  assert.deepEqual(checked, [4]);
  assert.deepEqual(skipped, []);
});

test("a candidate that fails the check now is passed over, with the reason", () => {
  const { issue: next, skipped } = pickNext(
    [issue(3, READY), issue(5, READY)],
    (n) =>
      n === 3
        ? {
            ok: false,
            output: "#3 isn't ready:\n- Blocked by #1, which is still open.\n",
          }
        : { ok: true, output: "" },
  );
  assert.equal(next.number, 5);
  assert.deepEqual(skipped, [
    {
      number: 3,
      reason: "#3 isn't ready:\n- Blocked by #1, which is still open.",
    },
  ]);
});

test("nothing is claimed when no candidate passes", () => {
  const { issue: next, skipped } = pickNext([issue(3, READY)], () => ({
    ok: false,
    output: "no",
  }));
  assert.equal(next, null);
  assert.equal(skipped.length, 1);
  assert.equal(pickNext([], () => ({ ok: true })).issue, null);
});
