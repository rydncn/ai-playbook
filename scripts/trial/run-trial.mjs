#!/usr/bin/env node
// Runs the ablation trial's arms headless through the Claude Agent SDK, each
// arm repeated, under a per-run and a monthly spend cap. See README.md here.
//
//   node run-trial.mjs run --config trial.json --brief brief.md --arm C --reps 3
//   node run-trial.mjs run ... --dry-run     the plan and the budget, no API calls
//   node run-trial.mjs report                every run so far, per arm
//   node run-trial.mjs spend                 this month's spend and what's left
//   node run-trial.mjs settle <runId> <usd>  correct a run that never settled
//
// Each repetition gets a fresh clone of the arm's starter repository and a
// fresh Claude config directory, so nothing from your own ~/.claude (plugins,
// settings, memory) reaches any arm. Every step of a repetition is a new
// session in the same workspace, as rule 17 asks, and the repetition's budget
// spans all its steps.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  appendLedger,
  mayStart,
  monthOf,
  readLedger,
  spentIn,
} from "./ledger.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Variables a run's Claude Code process gets. Everything else in your shell
// (cloud credentials, tokens, production keys) stays out of reach.
const PASSED_ENV = ["PATH", "LANG", "TERM", "ANTHROPIC_API_KEY"];

/** Reads and checks the trial config; throws one message naming every problem. */
export function loadConfig(text, file = "config") {
  const c = JSON.parse(text);
  const problems = [];
  if (typeof c.model !== "string")
    problems.push("model: a model id is required");
  if (!Array.isArray(c.steps) || c.steps.length === 0)
    problems.push("steps: at least one prompt is required");
  else
    c.steps.forEach((s, i) => {
      if (typeof s !== "string" || !s.trim())
        problems.push(`steps[${i}]: must be a non-empty prompt`);
    });
  const b = c.budget ?? {};
  for (const k of ["perRunUsd", "monthlyUsd"])
    if (!(b[k] > 0))
      problems.push(`budget.${k}: a positive number is required`);
  if (b.perRunUsd > b.monthlyUsd)
    problems.push("budget.perRunUsd: is more than budget.monthlyUsd");
  if (!c.arms || typeof c.arms !== "object" || !Object.keys(c.arms).length)
    problems.push("arms: at least one arm is required");
  for (const [id, a] of Object.entries(c.arms ?? {})) {
    if (typeof a.starter !== "string")
      problems.push(`arms.${id}.starter: a git URL or path is required`);
    for (const p of a.plugins ?? [])
      if (typeof p !== "string" || !path.isAbsolute(p))
        problems.push(`arms.${id}.plugins: "${p}" must be an absolute path`);
  }
  if (problems.length) throw new Error(`${file}:\n  ${problems.join("\n  ")}`);
  return c;
}

/** The Agent SDK options for one step. Pure, so the tests can read them. */
export function stepOptions({ config, arm, cwd, configDir, budgetLeft, env }) {
  return {
    cwd,
    model: config.model,
    ...(config.effort ? { effort: config.effort } : {}),
    maxBudgetUsd: budgetLeft,
    ...(config.budget.maxTurns ? { maxTurns: config.budget.maxTurns } : {}),
    // Only the workspace's own settings: the arm's .claude/ is what's tested.
    settingSources: ["project", "local"],
    plugins: (arm.plugins ?? []).map((p) => ({ type: "local", path: p })),
    // Nobody answers prompts in a headless run. This is only safe inside a
    // container or VM holding no other credentials (--isolated).
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    env: {
      ...Object.fromEntries(
        PASSED_ENV.filter((k) => env[k] !== undefined).map((k) => [k, env[k]]),
      ),
      HOME: path.dirname(configDir),
      CLAUDE_CONFIG_DIR: configDir,
      CLAUDE_AGENT_SDK_CLIENT_APP: "playbook-trial-runner",
      // HOME is the run's own folder, so git has no identity of its own.
      GIT_AUTHOR_NAME: "Trial",
      GIT_AUTHOR_EMAIL: "trial@example.invalid",
      GIT_COMMITTER_NAME: "Trial",
      GIT_COMMITTER_EMAIL: "trial@example.invalid",
    },
  };
}

/** Adds one step's SDK result into a repetition's running totals. */
export function addStep(totals, result) {
  totals.usd += result.total_cost_usd ?? 0;
  totals.turns += result.num_turns ?? 0;
  totals.durationMs += result.duration_ms ?? 0;
  totals.steps.push({
    subtype: result.subtype,
    usd: result.total_cost_usd ?? 0,
    turns: result.num_turns ?? 0,
    sessionId: result.session_id,
    errors: result.errors ?? [],
  });
  for (const [model, u] of Object.entries(result.modelUsage ?? {})) {
    const t = (totals.byModel[model] ??= {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      usd: 0,
    });
    t.input += u.inputTokens ?? 0;
    t.output += u.outputTokens ?? 0;
    t.cacheRead += u.cacheReadInputTokens ?? 0;
    t.cacheWrite += u.cacheCreationInputTokens ?? 0;
    t.usd += u.costUSD ?? 0;
  }
  return totals;
}

/** Share of prompt tokens served from the cache, or null with none counted. */
export function cacheShare(byModel) {
  let read = 0;
  let all = 0;
  for (const t of Object.values(byModel)) {
    read += t.cacheRead;
    all += t.cacheRead + t.cacheWrite + t.input;
  }
  return all ? read / all : null;
}

/** Problems that mean a repetition doesn't count, or its setup didn't take. */
export function warnings(arm, totals) {
  const out = [];
  for (const m of arm.pinnedModels ?? [])
    if (!Object.keys(totals.byModel).some((k) => k.includes(m)))
      out.push(
        `pinned model ${m} never answered: the pin didn't take effect, so this repetition doesn't count (rule 7)`,
      );
  const share = cacheShare(totals.byModel);
  if (share !== null && share < 0.5)
    out.push(
      `only ${(share * 100).toFixed(0)}% of prompt tokens came from the cache; look for something changing the prompt's start between calls`,
    );
  return out;
}

async function runRepetition({
  config,
  armId,
  rep,
  brief,
  out,
  query,
  env,
  log,
}) {
  const arm = config.arms[armId];
  const runId = `${new Date().toISOString().slice(0, 10)}-${armId}-${rep}-${randomBytes(2).toString("hex")}`;
  const dir = path.join(out, runId);
  const cwd = path.join(dir, "work");
  const configDir = path.join(dir, "home", ".claude");
  mkdirSync(configDir, { recursive: true });
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      ...(arm.ref ? ["--branch", arm.ref] : []),
      arm.starter,
      cwd,
    ],
    { stdio: "inherit" },
  );
  mkdirSync(path.join(cwd, "docs"), { recursive: true });
  copyFileSync(brief, path.join(cwd, "docs", "brief.md"));

  const ledger = path.join(out, "ledger.jsonl");
  const month = monthOf(new Date());
  const cap = config.budget.perRunUsd;
  appendLedger(ledger, {
    runId,
    month,
    status: "reserved",
    usd: cap,
    at: new Date().toISOString(),
  });

  const totals = { usd: 0, turns: 0, durationMs: 0, steps: [], byModel: {} };
  let stopped = null;
  // A crash leaves the reservation standing, and a step with no result settles
  // at the cap: either was billed for tokens nobody counted.
  let uncounted = false;
  for (const [i, prompt] of config.steps.entries()) {
    const budgetLeft = cap - totals.usd;
    if (budgetLeft <= 0) {
      stopped = `budget spent before step ${i + 1}`;
      break;
    }
    log(
      `${runId}: step ${i + 1}/${config.steps.length}, $${budgetLeft.toFixed(2)} left`,
    );
    let result = null;
    try {
      for await (const msg of query({
        prompt,
        options: stepOptions({ config, arm, cwd, configDir, budgetLeft, env }),
      }))
        if (msg.type === "result") result = msg;
    } catch (err) {
      // The SDK throws after yielding an error result (a bad key, say), so
      // a result in hand is still counted; without one, the crash stands.
      if (!result) throw err;
    }
    if (!result) {
      stopped = `step ${i + 1} ended without a result`;
      uncounted = true;
      break;
    }
    addStep(totals, result);
    // An error can come back as subtype "success" with is_error set.
    if (result.subtype !== "success" || result.is_error) {
      stopped = `step ${i + 1}: ${result.subtype}${result.is_error ? `, error: ${String(result.result ?? result.errors?.join("; ") ?? "").slice(0, 200)}` : ""}`;
      break;
    }
  }
  // The SDK's figure is an estimate; the Console stays the bill.
  appendLedger(ledger, {
    runId,
    month,
    status: uncounted ? "settled at the cap" : "settled",
    usd: uncounted ? Math.max(cap, totals.usd) : totals.usd,
    at: new Date().toISOString(),
  });

  const record = {
    runId,
    arm: armId,
    rep,
    model: config.model,
    effort: config.effort ?? null,
    finished: stopped === null,
    stopped,
    ...totals,
    cacheShare: cacheShare(totals.byModel),
    warnings: warnings(arm, totals),
    transcripts: path.join(configDir, "projects"),
  };
  writeFileSync(
    path.join(dir, "result.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  return record;
}

/** Reads every result.json under the output folder. */
export function readResults(out) {
  if (!existsSync(out)) return [];
  return readdirSync(out, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && existsSync(path.join(out, d.name, "result.json")),
    )
    .map((d) =>
      JSON.parse(readFileSync(path.join(out, d.name, "result.json"), "utf8")),
    );
}

/** Per-arm summary lines for the report. */
export function report(results) {
  const byArm = new Map();
  for (const r of results)
    (byArm.get(r.arm) ?? byArm.set(r.arm, []).get(r.arm)).push(r);
  const lines = [];
  for (const [arm, rs] of [...byArm].sort()) {
    const usd = rs.map((r) => r.usd);
    const mean = usd.reduce((a, b) => a + b, 0) / usd.length;
    const done = rs.filter((r) => r.finished).length;
    const shares = rs.map((r) => r.cacheShare).filter((s) => s !== null);
    const share = shares.length
      ? shares.reduce((a, b) => a + b, 0) / shares.length
      : null;
    lines.push(
      `${arm}: ${rs.length} run(s), ${done} finished · $${mean.toFixed(2)} mean, $${Math.min(...usd).toFixed(2)}–$${Math.max(...usd).toFixed(2)} · ${Math.round(rs.reduce((a, r) => a + r.turns, 0) / rs.length)} turns mean · ${share === null ? "no" : (share * 100).toFixed(0) + "%"} cache reads`,
    );
    const models = {};
    for (const r of rs)
      for (const [m, t] of Object.entries(r.byModel))
        models[m] = (models[m] ?? 0) + t.usd;
    for (const [m, u] of Object.entries(models))
      lines.push(`  ${m}: $${(u / rs.length).toFixed(2)} mean per run`);
    for (const r of rs)
      for (const w of r.warnings) lines.push(`  ! ${r.runId}: ${w}`);
  }
  return lines;
}

async function main(argv) {
  const [command, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      config: { type: "string", default: path.join(HERE, "trial.json") },
      brief: { type: "string" },
      arm: { type: "string", multiple: true },
      reps: { type: "string", default: "1" },
      out: { type: "string", default: path.join(HERE, "runs") },
      "dry-run": { type: "boolean", default: false },
      isolated: { type: "boolean", default: false },
    },
  });
  const ledgerFile = path.join(values.out, "ledger.jsonl");
  const month = monthOf(new Date());

  if (command === "report") {
    const lines = report(readResults(values.out));
    console.log(lines.length ? lines.join("\n") : "No runs yet.");
    return 0;
  }
  if (command === "spend" || command === "settle") {
    if (command === "settle") {
      const [runId, usd] = positionals;
      const row = readLedger(ledgerFile).find((r) => r.runId === runId);
      if (!row || !(Number(usd) >= 0)) {
        console.error(
          "usage: settle <runId from the ledger> <usd from the Console>",
        );
        return 1;
      }
      appendLedger(ledgerFile, {
        runId,
        month: row.month,
        status: "settled by hand",
        usd: Number(usd),
        at: new Date().toISOString(),
      });
    }
    const spent = spentIn(readLedger(ledgerFile), month);
    console.log(`${month}: $${spent.toFixed(2)} spent or reserved`);
    return 0;
  }
  if (command !== "run") {
    console.error(
      "usage: run-trial.mjs run|report|spend|settle (see the comment at the top)",
    );
    return 1;
  }

  const config = loadConfig(readFileSync(values.config, "utf8"), values.config);
  const arms = values.arm ?? Object.keys(config.arms);
  const reps = Number(values.reps);
  const unknown = arms.filter((a) => !config.arms[a]);
  if (
    unknown.length ||
    !(reps >= 1) ||
    !values.brief ||
    !existsSync(values.brief)
  ) {
    console.error(
      unknown.length
        ? `no such arm in ${values.config}: ${unknown.join(", ")}`
        : !(reps >= 1)
          ? "--reps must be 1 or more"
          : "--brief must name the brief's file",
    );
    return 1;
  }
  const { perRunUsd, monthlyUsd } = config.budget;
  const spent = spentIn(readLedger(ledgerFile), month);
  const planned = arms.length * reps;
  console.log(
    `${planned} run(s): arm ${arms.join(", ")} × ${reps}, ${config.model}${config.effort ? ` at ${config.effort} effort` : ""}, up to $${perRunUsd.toFixed(2)} each. ${month}: $${spent.toFixed(2)} of $${monthlyUsd.toFixed(2)} spent or reserved.`,
  );
  if (values["dry-run"]) {
    const fits = Math.max(
      0,
      Math.floor((monthlyUsd - spent) / (perRunUsd * 1.1)),
    );
    console.log(
      fits >= planned
        ? `Dry run: all ${planned} fit in what's left this month, even if each spends its whole cap.`
        : `Dry run: if each spends its whole cap, ${fits} of the ${planned} fit in what's left this month; the runner stops before the rest.`,
    );
    return 0;
  }
  if (!values.isolated) {
    console.error(
      "Refusing to start: runs skip every permission prompt. Run inside a container or VM that holds only a trial API key, then pass --isolated (README.md).",
    );
    return 1;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY is not set: use a key from the trial's own Console workspace.",
    );
    return 1;
  }

  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  mkdirSync(values.out, { recursive: true });
  // Interleave arms (A1, C1, A2, C2...) so a stop part-way leaves every arm
  // with about as many repetitions.
  for (let rep = 1; rep <= reps; rep++)
    for (const armId of arms) {
      const gate = mayStart({
        spent: spentIn(readLedger(ledgerFile), month),
        perRunUsd,
        monthlyUsd,
      });
      if (!gate.ok) {
        console.error(
          `Stopping before arm ${armId} repetition ${rep}: ${gate.reason}.`,
        );
        return 2;
      }
      const r = await runRepetition({
        config,
        armId,
        rep,
        brief: values.brief,
        out: values.out,
        query,
        env: process.env,
        log: (m) => console.log(m),
      });
      console.log(
        `${r.runId}: ${r.finished ? "finished" : `stopped (${r.stopped})`}, $${r.usd.toFixed(2)}, ${r.turns} turns`,
      );
      for (const w of r.warnings) console.log(`  ! ${w}`);
    }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(1);
    },
  );
}

export { runRepetition };
