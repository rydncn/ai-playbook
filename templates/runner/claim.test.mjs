import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAIMED, candidate, pickNext } from "./claim.mjs";

const issue = (number, labels, over = {}) => ({
  number,
  title: `Slice ${number}`,
  state: "open",
  user: { login: "Ryan", type: "User" },
  labels: labels.map((name) => ({ name })),
  ...over,
});
const READY = ["slice", "ready", "afk"];
const APPROVERS = ["ryan"];
const cand = (i) => candidate(i, APPROVERS);

test("a candidate is an open slice labelled ready and afk", () => {
  assert.ok(cand(issue(1, READY)));
  assert.ok(cand(issue(1, ["Slice", "Ready", "AFK"])));
  assert.ok(!cand(issue(1, ["slice", "afk"])), "not ready");
  assert.ok(!cand(issue(1, ["slice", "ready"])), "no mode");
  assert.ok(!cand(issue(1, [...READY, "hitl"])), "both modes");
  assert.ok(!cand(issue(1, [...READY, CLAIMED])), "already claimed");
  assert.ok(!cand(issue(1, READY, { state: "closed" })));
  assert.ok(!cand(issue(1, READY, { pull_request: {} })), "a pull request");
});

test("only issues an approver wrote are candidates", () => {
  assert.ok(
    !cand(issue(1, READY, { user: { login: "someone", type: "User" } })),
  );
  assert.ok(!cand(issue(1, READY, { user: { login: "ryan", type: "Bot" } })));
  assert.ok(!cand(issue(1, READY, { user: null })));
  assert.ok(!candidate(issue(1, READY), []));
});

test("the oldest candidate that passes the ticket check is claimed", () => {
  const checked = [];
  const { issue: next, skipped } = pickNext(
    [issue(9, READY), issue(4, READY), issue(2, ["slice", "afk"])],
    (n) => {
      checked.push(n);
      return { ok: true, output: "" };
    },
    APPROVERS,
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
    APPROVERS,
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
  const { issue: next, skipped } = pickNext(
    [issue(3, READY)],
    () => ({ ok: false, output: "no" }),
    APPROVERS,
  );
  assert.equal(next, null);
  assert.equal(skipped.length, 1);
  assert.equal(pickNext([], () => ({ ok: true }), APPROVERS).issue, null);
});
