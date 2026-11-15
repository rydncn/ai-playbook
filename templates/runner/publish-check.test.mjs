import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ONE_WAY,
  door,
  parsePaths,
  prBody,
  problems,
} from "./publish-check.mjs";

const check = (files, issueDoor = "two-way", oneWay = DEFAULT_ONE_WAY) =>
  problems({ files, issueDoor, oneWay });

test("a two-way slice changing ordinary code may be published", () => {
  assert.deepEqual(check(["src/import.ts", "test/import.test.ts"]), []);
});

test("nothing that steers the agent or checks its work may change", () => {
  for (const f of [
    ".github/workflows/ci.yml",
    ".github/one-way-paths",
    ".claude/settings.json",
    ".mcp.json",
    "CLAUDE.md",
    "src/api/CLAUDE.md",
    "AGENTS.md",
    ".devcontainer/devcontainer.json",
    ".gitattributes",
    "scripts/check-criteria.mjs",
    "scripts/check-ticket.mjs",
    "scripts/review-gate.mjs",
    "scripts/claim.mjs",
    "scripts/publish-check.mjs",
    "playwright.config.ts",
    "web/vitest.config.mts",
    "jest.config.js",
    "tests/conftest.py",
    "pytest.ini",
  ]) {
    const found = check([f], "one-way");
    assert.equal(found.length, 1, f);
    assert.match(found[0], /may not change/);
  }
  assert.deepEqual(check(["scripts/seed.mjs", "docs/github.md"]), []);
});

test("a two-way slice may not touch a one-way path; a one-way slice may", () => {
  const files = ["db/migrations/0004_add_refunds.sql", "src/refund.ts"];
  assert.deepEqual(check(files, "two-way"), [
    "db/migrations/0004_add_refunds.sql: a one-way path, and the issue says two-way. A person decides whether the slice changes it.",
  ]);
  assert.deepEqual(check(files, "one-way"), []);
  assert.equal(
    check(files, "").length,
    1,
    "an undecided door counts as two-way",
  );
});

test("the project's own one-way paths are used when it has them", () => {
  const oneWay = parsePaths("# auth\nsrc/auth/\n/app.json # release\n");
  assert.deepEqual(oneWay, ["src/auth", "app.json"]);
  assert.equal(check(["src/auth/session.ts"], "two-way", oneWay).length, 1);
  assert.equal(check(["app.json"], "two-way", oneWay).length, 1);
  assert.deepEqual(check(["db/migrations/1.sql"], "two-way", oneWay), []);
});

test("a session that committed nothing has nothing to publish", () => {
  assert.deepEqual(check([]), ["The session committed no changes."]);
});

test("the door is read from the issue form", () => {
  assert.equal(
    door("### Door\n\nOne-way\n\n### One-way files\n\nx"),
    "one-way",
  );
  assert.equal(door("### Door\n\nTwo-way"), "two-way");
  assert.equal(door("### Door\n\n_No response_"), "");
  assert.equal(door(undefined), "");
});

test("the body closes the slice's issue and no other", () => {
  const body = prBody(
    12,
    "Adds refunds. Closes #3, fixes: o/r#4, resolves https://github.com/o/r/issues/5.\nSee #6.",
  );
  assert.equal(
    body,
    "Closes #12\n\nAdds refunds. #3, o/r#4, https://github.com/o/r/issues/5.\nSee #6.\n",
  );
  assert.equal(prBody(7, ""), "Closes #7\n\n(The session left no summary.)\n");
  assert.equal(
    prBody(7, "This closes nothing."),
    "Closes #7\n\nThis closes nothing.\n",
  );
});
