import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addStep,
  cacheShare,
  loadConfig,
  report,
  readResults,
  runRepetition,
  stepOptions,
  warnings,
} from "./run-trial.mjs";
import { readLedger, spentIn, monthOf } from "./ledger.mjs";

const config = (over = {}) => ({
  model: "claude-opus-5-5",
  effort: "high",
  budget: { perRunUsd: 10, monthlyUsd: 60 },
  steps: ["design", "build"],
  arms: { A: { starter: "/tmp/a" } },
  ...over,
});

test("the example config loads", () => {
  const text = readFileSync(
    new URL("./trial.example.json", import.meta.url),
    "utf8",
  );
  assert.ok(loadConfig(text).arms.E.pinnedModels.length);
});

test("a bad config names every problem at once", () => {
  assert.throws(
    () =>
      loadConfig(
        JSON.stringify({
          steps: [],
          budget: { perRunUsd: 90, monthlyUsd: 60 },
          arms: { C: { starter: "x", plugins: ["relative/path"] } },
        }),
      ),
    (e) =>
      /model:/.test(e.message) &&
      /steps:/.test(e.message) &&
      /perRunUsd: is more than/.test(e.message) &&
      /must be an absolute path/.test(e.message),
  );
});

test("a step runs on the arm's settings only, with a scrubbed environment", () => {
  const o = stepOptions({
    config: config(),
    arm: { starter: "x", plugins: ["/p/playbook"] },
    cwd: "/runs/r/work",
    configDir: "/runs/r/home/.claude",
    budgetLeft: 7.5,
    env: {
      PATH: "/bin",
      ANTHROPIC_API_KEY: "k",
      AWS_SECRET_ACCESS_KEY: "nope",
      GH_TOKEN: "nope",
    },
  });
  assert.equal(o.maxBudgetUsd, 7.5);
  assert.equal(o.model, "claude-opus-5-5");
  assert.equal(o.effort, "high");
  assert.deepEqual(o.settingSources, ["project", "local"]);
  assert.deepEqual(o.plugins, [{ type: "local", path: "/p/playbook" }]);
  assert.equal(o.env.CLAUDE_CONFIG_DIR, "/runs/r/home/.claude");
  assert.equal(o.env.HOME, "/runs/r/home");
  assert.equal(o.env.ANTHROPIC_API_KEY, "k");
  assert.equal(o.env.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(o.env.GH_TOKEN, undefined);
});

const result = (over = {}) => ({
  type: "result",
  subtype: "success",
  total_cost_usd: 2,
  num_turns: 10,
  duration_ms: 1000,
  session_id: "s",
  modelUsage: {
    "claude-opus-5-5": {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 800,
      cacheCreationInputTokens: 100,
      costUSD: 2,
    },
  },
  ...over,
});

test("steps add up per model, and the cache share is read over all prompt tokens", () => {
  const t = { usd: 0, turns: 0, durationMs: 0, steps: [], byModel: {} };
  addStep(t, result());
  addStep(t, result());
  assert.equal(t.usd, 4);
  assert.equal(t.turns, 20);
  assert.equal(t.byModel["claude-opus-5-5"].cacheRead, 1600);
  assert.equal(cacheShare(t.byModel), 0.8);
});

test("a pinned model that never answered means the repetition doesn't count", () => {
  const t = addStep(
    { usd: 0, turns: 0, durationMs: 0, steps: [], byModel: {} },
    result(),
  );
  const w = warnings({ pinnedModels: ["claude-haiku-5-5"] }, t);
  assert.match(w.join(), /claude-haiku-5-5 never answered/);
  t.byModel["claude-haiku-5-5"] = {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    usd: 0,
  };
  assert.deepEqual(warnings({ pinnedModels: ["claude-haiku-5-5"] }, t), []);
});

test("a cold cache is flagged", () => {
  const t = addStep(
    { usd: 0, turns: 0, durationMs: 0, steps: [], byModel: {} },
    result({
      modelUsage: {
        m: {
          inputTokens: 900,
          outputTokens: 1,
          cacheReadInputTokens: 100,
          cacheCreationInputTokens: 0,
          costUSD: 1,
        },
      },
    }),
  );
  assert.match(warnings({}, t).join(), /10% of prompt tokens/);
});

function starterRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "starter-"));
  const git = (...a) =>
    execFileSync("git", a, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    });
  git("init", "--quiet", "-b", "main");
  writeFileSync(path.join(dir, "README.md"), "starter\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "start");
  return dir;
}

function fakeQuery(results, seen) {
  let i = 0;
  return ({ prompt, options }) => {
    seen.push({ prompt, options });
    const r = results[i++];
    return (async function* () {
      yield { type: "system", subtype: "init" };
      if (r) yield r;
    })();
  };
}

test("a repetition runs each step as its own session, settles the ledger and writes its record", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "runs-"));
  const brief = path.join(out, "brief.md");
  writeFileSync(brief, "the brief\n");
  const seen = [];
  const r = await runRepetition({
    config: config({ arms: { A: { starter: starterRepo() } } }),
    armId: "A",
    rep: 1,
    brief,
    out,
    query: fakeQuery([result({ total_cost_usd: 3 }), result()], seen),
    env: {},
    log: () => {},
  });
  assert.equal(r.finished, true);
  assert.equal(r.usd, 5);
  assert.deepEqual(
    seen.map((s) => s.prompt),
    ["design", "build"],
  );
  // The second step only gets what the first left of the cap.
  assert.equal(seen[1].options.maxBudgetUsd, 7);
  assert.equal(
    readFileSync(path.join(seen[0].options.cwd, "docs", "brief.md"), "utf8"),
    "the brief\n",
  );
  const rows = readLedger(path.join(out, "ledger.jsonl"));
  assert.deepEqual(
    rows.map((x) => x.status),
    ["reserved", "settled"],
  );
  assert.equal(spentIn(rows, monthOf(new Date())), 5);
  assert.deepEqual(readResults(out)[0].runId, r.runId);
  assert.match(
    report(readResults(out))[0],
    /^A: 1 run\(s\), 1 finished · \$5\.00 mean/,
  );
});

test("a step that hits its budget stops the repetition and keeps what it cost", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "runs-"));
  const brief = path.join(out, "brief.md");
  writeFileSync(brief, "b\n");
  const seen = [];
  const r = await runRepetition({
    config: config({ arms: { A: { starter: starterRepo() } } }),
    armId: "A",
    rep: 1,
    brief,
    out,
    query: fakeQuery(
      [result({ subtype: "error_max_budget_usd", total_cost_usd: 10.4 })],
      seen,
    ),
    env: {},
    log: () => {},
  });
  assert.equal(seen.length, 1);
  assert.equal(r.finished, false);
  assert.match(r.stopped, /error_max_budget_usd/);
  assert.equal(
    spentIn(readLedger(path.join(out, "ledger.jsonl")), monthOf(new Date())),
    10.4,
  );
});

test("a crash mid-step leaves the whole cap reserved, since its tokens went uncounted", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "runs-"));
  const brief = path.join(out, "brief.md");
  writeFileSync(brief, "b\n");
  mkdirSync(out, { recursive: true });
  const boom = () =>
    (async function* () {
      throw new Error("network");
    })();
  await assert.rejects(
    runRepetition({
      config: config({ arms: { A: { starter: starterRepo() } } }),
      armId: "A",
      rep: 1,
      brief,
      out,
      query: boom,
      env: {},
      log: () => {},
    }),
    /network/,
  );
  const rows = readLedger(path.join(out, "ledger.jsonl"));
  assert.deepEqual(
    rows.map((x) => x.status),
    ["reserved"],
  );
  assert.equal(spentIn(rows, monthOf(new Date())), 10);
});

test("an error result the SDK throws after is counted and stops the repetition", async () => {
  // Seen against the real SDK with a bad key: a result with subtype
  // "success" and is_error set, then a throw.
  const out = mkdtempSync(path.join(tmpdir(), "runs-"));
  const brief = path.join(out, "brief.md");
  writeFileSync(brief, "b\n");
  const bad = () =>
    (async function* () {
      yield result({
        is_error: true,
        result: "Invalid API key",
        total_cost_usd: 0,
      });
      throw new Error("Claude Code returned an error result");
    })();
  const r = await runRepetition({
    config: config({ arms: { A: { starter: starterRepo() } } }),
    armId: "A",
    rep: 1,
    brief,
    out,
    query: bad,
    env: {},
    log: () => {},
  });
  assert.equal(r.finished, false);
  assert.match(r.stopped, /Invalid API key/);
  assert.equal(r.steps.length, 1);
  assert.equal(
    spentIn(readLedger(path.join(out, "ledger.jsonl")), monthOf(new Date())),
    0,
  );
});

test("a step that yields no result settles at the cap", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "runs-"));
  const brief = path.join(out, "brief.md");
  writeFileSync(brief, "b\n");
  const r = await runRepetition({
    config: config({ arms: { A: { starter: starterRepo() } } }),
    armId: "A",
    rep: 1,
    brief,
    out,
    query: fakeQuery([], []),
    env: {},
    log: () => {},
  });
  assert.match(r.stopped, /without a result/);
  assert.equal(
    spentIn(readLedger(path.join(out, "ledger.jsonl")), monthOf(new Date())),
    10,
  );
});
