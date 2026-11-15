import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_LABEL,
  DEFAULT_ONE_WAY,
  approval,
  decide,
  globToRegExp,
  oneWayFiles,
  parsePaths,
  parseVerdict,
  recordedVerdict,
} from "./gate.mjs";

const head = "a".repeat(40);
const person = { login: "Ryan", type: "User" };
const bot = { login: "claude[bot]", type: "Bot" };
const verdict = (v) =>
  JSON.stringify({ must_fix: 0, should_fix: 0, door: "two-way", ...v });
const base = {
  files: ["src/app.ts"],
  globs: DEFAULT_ONE_WAY,
  approvers: ["ryan"],
  head,
  reviews: [],
  labels: [],
  labelEvents: [],
};

test("globs match folders, nested names and nothing else", () => {
  assert.ok(globToRegExp(".claude/**").test(".claude/hooks/x.mjs"));
  assert.ok(globToRegExp("**/CLAUDE.md").test("CLAUDE.md"));
  assert.ok(globToRegExp("**/CLAUDE.md").test("app/CLAUDE.md"));
  assert.ok(globToRegExp("**/migrations/**").test("db/migrations/001.sql"));
  assert.ok(globToRegExp("src/auth").test("src/auth/session.ts"));
  assert.ok(!globToRegExp("package.json").test("apps/web/package.json"));
  assert.ok(!globToRegExp("src/*.ts").test("src/a/b.ts"));
  assert.ok(!globToRegExp(".mcp.json").test("xmcpxjson"));
});

test("a paths file reads one glob per line, ignoring comments", () => {
  assert.deepEqual(parsePaths("# one-way\n/src/auth/\n\nsupabase/** # db\n"), [
    "src/auth",
    "supabase/**",
  ]);
});

test("the shipped one-way-paths template catches what it lists, folders included", () => {
  const globs = parsePaths(
    readFileSync(new URL("./one-way-paths", import.meta.url), "utf8"),
  );
  const files = [
    ".claude/settings.json",
    ".github/workflows/ci.yml",
    "db/migrations/1.sql",
    "scripts/check-criteria.mjs",
    "web/package.json",
    "src/a.ts",
  ];
  assert.deepEqual(oneWayFiles(files, globs), files.slice(0, 4));
});

test("the default list catches agent configuration, workflows and migrations", () => {
  const files = [
    ".claude/settings.json",
    ".github/workflows/ci.yml",
    "db/migrations/1.sql",
    "src/a.ts",
  ];
  assert.deepEqual(oneWayFiles(files, DEFAULT_ONE_WAY), files.slice(0, 3));
});

test("a missing or malformed verdict fails closed", () => {
  for (const text of [
    "",
    "not json",
    '{"door":"two-way"}',
    '{"must_fix":-1,"door":"two-way"}',
    '{"must_fix":0}',
  ]) {
    assert.ok(parseVerdict(text).error, text);
    assert.equal(decide({ ...base, verdictText: text }).pass, false, text);
  }
});

test("no approvers configured fails, saying what to set", () => {
  const r = decide({ ...base, approvers: [], verdictText: verdict() });
  assert.equal(r.pass, false);
  assert.match(r.lines.at(-1), /HUMAN_APPROVERS/);
});

test("a clean two-way change passes without a person", () => {
  assert.equal(decide({ ...base, verdictText: verdict() }).pass, true);
});

test("a must-fix finding fails until fixed or a person rules on it", () => {
  const r = decide({ ...base, verdictText: verdict({ must_fix: 2 }) });
  assert.equal(r.pass, false);
  assert.match(r.lines.at(-1), /2 must-fix/);
});

test("a one-way path fails without a person, whatever the reviewer says", () => {
  const r = decide({
    ...base,
    files: [".claude/settings.json"],
    verdictText: verdict(),
  });
  assert.equal(r.pass, false);
  assert.match(r.lines.join("\n"), /paths: \.claude\/settings\.json/);
});

test("the reviewer calling it one-way is enough to need a person", () => {
  assert.equal(
    decide({ ...base, verdictText: verdict({ door: "one-way" }) }).pass,
    false,
  );
});

test("an approving review on the head commit by an approver passes a one-way door", () => {
  const reviews = [{ state: "APPROVED", commit_id: head, user: person }];
  const r = decide({
    ...base,
    files: ["db/migrations/1.sql"],
    reviews,
    verdictText: verdict(),
  });
  assert.equal(r.pass, true);
  assert.match(r.lines.at(-1), /approved by Ryan/);
});

test("an approval on an older commit, by a bot or by someone else doesn't count", () => {
  const cases = [
    [{ state: "APPROVED", commit_id: "b".repeat(40), user: person }],
    [{ state: "APPROVED", commit_id: head, user: bot }],
    [
      {
        state: "APPROVED",
        commit_id: head,
        user: { login: "mallory", type: "User" },
      },
    ],
    [{ state: "COMMENTED", commit_id: head, user: person }],
  ];
  for (const reviews of cases)
    assert.equal(approval({ ...base, reviews }), null);
});

test("the approval label counts only when an approver added it", () => {
  const labelled = (actor) => ({
    ...base,
    labels: [APPROVAL_LABEL],
    labelEvents: [{ event: "labeled", label: { name: APPROVAL_LABEL }, actor }],
  });
  assert.match(approval(labelled(person)), /labelled human-approved by Ryan/);
  assert.equal(approval(labelled(bot)), null);
  assert.equal(approval(labelled({ login: "mallory", type: "User" })), null);
  // Removed on the last push: the old event no longer counts.
  assert.equal(approval({ ...labelled(person), labels: [] }), null);
});

test("the latest labelling decides, so a bot re-adding it after a person doesn't count", () => {
  const ctx = {
    ...base,
    labels: [APPROVAL_LABEL],
    labelEvents: [
      { event: "labeled", label: { name: APPROVAL_LABEL }, actor: person },
      { event: "unlabeled", label: { name: APPROVAL_LABEL }, actor: bot },
      { event: "labeled", label: { name: APPROVAL_LABEL }, actor: bot },
    ],
  };
  assert.equal(approval(ctx), null);
});

test("a person's approval also overrides must-fix findings", () => {
  const reviews = [{ state: "APPROVED", commit_id: head, user: person }];
  assert.equal(
    decide({ ...base, reviews, verdictText: verdict({ must_fix: 1 }) }).pass,
    true,
  );
});

test("a bot never approves, even when its login is in the approvers list", () => {
  const reviews = [{ state: "APPROVED", commit_id: head, user: bot }];
  assert.equal(
    approval({ ...base, approvers: ["ryan", "claude[bot]"], reviews }),
    null,
  );
});

test("the verdict is read only from the workflow's own comment for this commit", () => {
  const body = (sha, v) =>
    `<!-- review-gate-verdict ${sha} -->\n\`\`\`json\n${v}\n\`\`\``;
  const actions = { login: "github-actions[bot]", type: "Bot" };
  const comments = [
    { user: actions, body: body(head, verdict({ must_fix: 3 })) },
    { user: person, body: body(head, verdict()) },
    { user: actions, body: body("b".repeat(40), verdict()) },
  ];
  assert.equal(JSON.parse(recordedVerdict(comments, head)).must_fix, 3);
  assert.equal(recordedVerdict(comments.slice(1), head), "");
});

test("no verdict passes only with a person's approval of this commit", () => {
  assert.equal(decide({ ...base, verdictText: "" }).pass, false);
  const reviews = [{ state: "APPROVED", commit_id: head, user: person }];
  assert.equal(decide({ ...base, reviews, verdictText: "" }).pass, true);
});
