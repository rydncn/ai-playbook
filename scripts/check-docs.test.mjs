import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  anchors,
  brokenLinks,
  checkRepository,
  hookFiles,
  links,
  reviewQuestionCount,
  slug,
  wrongHookCounts,
  wrongQuestionCounts,
} from "./check-docs.mjs";

test("headings become GitHub's anchors, with repeats numbered", () => {
  assert.equal(slug("5. Independent review"), "5-independent-review");
  assert.equal(slug("The `pre-push` hook"), "the-pre-push-hook");
  assert.deepEqual(
    [...anchors("# A\n## B\n## B\n```\n# not a heading\n```\n")],
    ["a", "b", "b-1"],
  );
});

test("only relative links are collected, outside code", () => {
  const md =
    "[a](rules/a.md) [b](https://x.example) [c](#here) `[d](d.md)`\n```\n[e](e.md)\n```\n";
  assert.deepEqual(links(md), [
    { target: "rules/a.md", anchor: null },
    { target: "", anchor: "here" },
  ]);
});

test("a link to a missing file or heading is a problem", () => {
  const files = { "docs/x.md": "# Real heading\n" };
  const io = { exists: (p) => p in files, read: (p) => files[p] };
  assert.deepEqual(brokenLinks("docs/y.md", "[ok](x.md#real-heading)", io), []);
  assert.deepEqual(brokenLinks("docs/y.md", "[gone](missing.md)", io), [
    "docs/y.md: link to missing.md points at nothing",
  ]);
  assert.deepEqual(brokenLinks("docs/y.md", "[bad](x.md#nope)", io), [
    "docs/y.md: link to x.md#nope has no matching heading",
  ]);
});

test("the review questions are counted from REVIEW.md's item 2", () => {
  const review = [
    "1. **Agent configuration**",
    "2. **The five questions a reader doesn't ask:**",
    "   - **One?** a",
    "   - **Two?** b",
    "   - **Three?** c",
    "3. **Lifecycles.**",
    "   - **Not a question**",
  ].join("\n");
  assert.equal(reviewQuestionCount(review), 3);
});

test("a stale question count is a problem; 'the first four' is not", () => {
  assert.deepEqual(wrongQuestionCounts("a.md", "the five questions", 5), []);
  assert.deepEqual(
    wrongQuestionCounts("a.md", "the first four questions", 5),
    [],
  );
  assert.deepEqual(
    wrongQuestionCounts("a.md", "asks four review questions", 5),
    ['a.md: says "four review questions", but templates/REVIEW.md asks five'],
  );
});

test("a stale hook count is a problem", () => {
  const files = hookFiles([
    "README.md",
    "a.mjs",
    "b.mjs",
    "hooks.test.mjs",
    "pre-push",
    "settings.hooks.json",
  ]);
  assert.deepEqual(files, ["a.mjs", "b.mjs", "pre-push"]);
  assert.deepEqual(wrongHookCounts("a.md", "Copy all three files", 3), []);
  assert.deepEqual(wrongHookCounts("a.md", "Copy all four into", 3), [
    'a.md: says "Copy all four", but templates/hooks has three files to copy',
  ]);
});

test("this repository's documents agree", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  assert.deepEqual(checkRepository(root), []);
});
