#!/usr/bin/env node
/**
 * ESLint ratchet. Counts ESLint findings (errors and warnings) per rule for
 * each target folder and fails if any count goes up compared with the
 * committed baseline in eslint-baseline.json.
 *
 * Existing findings don't block anything, so stricter rules can be switched
 * on before the backlog is cleared, but nothing gets worse. When counts go
 * down, lower the baseline so the improvement is locked in.
 *
 *   node check-lint-ratchet.js . apps/web            # check
 *   node check-lint-ratchet.js . apps/web --update   # record
 *
 * Run it from the repository root. A target with no baseline fails: a check
 * that has nothing to compare against must not pass.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BASELINE_FILE = "eslint-baseline.json";

/** { ruleId: count } from ESLint's JSON formatter output. */
function countByRule(results) {
  const counts = {};
  for (const file of results) {
    for (const message of file.messages) {
      const rule = message.ruleId ?? "parse-error";
      counts[rule] = (counts[rule] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort());
}

/** Rules whose count rose or fell between baseline and current. */
function compare(baseline, current) {
  const increases = [];
  const decreases = [];
  const rules = new Set([...Object.keys(baseline), ...Object.keys(current)]);
  for (const rule of [...rules].sort()) {
    const before = baseline[rule] ?? 0;
    const now = current[rule] ?? 0;
    if (now > before) increases.push({ rule, before, now });
    if (now < before) decreases.push({ rule, before, now });
  }
  return { increases, decreases };
}

/**
 * Decide the outcome for a set of targets. Pure, so it can be tested
 * without running ESLint. Returns { ok, lines }.
 */
function evaluate(baselineFile, currentByTarget) {
  const lines = [];
  let ok = true;
  for (const [target, current] of Object.entries(currentByTarget)) {
    const baseline = baselineFile[target];
    if (!baseline) {
      ok = false;
      lines.push(`✗ ${target}: no baseline recorded. Run again with --update`);
      continue;
    }
    const { increases, decreases } = compare(baseline, current);
    for (const i of increases) {
      ok = false;
      lines.push(`✗ ${target}: ${i.rule} rose from ${i.before} to ${i.now}`);
    }
    for (const d of decreases) {
      lines.push(
        `↓ ${target}: ${d.rule} fell from ${d.before} to ${d.now}; lock it in by running again with --update`,
      );
    }
    if (increases.length === 0) {
      const total = Object.values(current).reduce((a, b) => a + b, 0);
      lines.push(`✓ ${target}: no rule got worse (${total} findings in total)`);
    }
  }
  return { ok, lines };
}

function runEslint(root, target) {
  const cwd = path.join(root, target);
  try {
    return JSON.parse(
      execFileSync("npx", ["eslint", ".", "--format", "json"], {
        cwd,
        encoding: "utf8",
        maxBuffer: 512 * 1024 * 1024,
        stdio: ["ignore", "pipe", "inherit"],
      }),
    );
  } catch (error) {
    // ESLint exits 1 when there are errors but still prints the report.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes("--update");
  const targets = args.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    console.error("Usage: check-lint-ratchet.js <target>... [--update]");
    process.exitCode = 1;
    return;
  }
  const root = process.cwd();
  const baselinePath = path.join(root, BASELINE_FILE);
  const baselineFile = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
    : {};
  const current = Object.fromEntries(
    targets.map((t) => [t, countByRule(runEslint(root, t))]),
  );

  if (update) {
    const next = { ...baselineFile, ...current };
    fs.writeFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n");
    console.log(
      `Recorded the baseline for ${targets.join(", ")} in ${BASELINE_FILE}. Commit it.`,
    );
    return;
  }

  const { ok, lines } = evaluate(baselineFile, current);
  for (const line of lines)
    (line.startsWith("✗") ? console.error : console.log)(line);
  if (!ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { countByRule, compare, evaluate };
