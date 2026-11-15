#!/usr/bin/env node
// Criteria coverage: a required check that every acceptance criterion a
// slice says it satisfies has a test that names it, and that the test ran and
// passed in this run.
//
// The slice issue's Satisfies field quotes its criteria by number (AC3, AC4).
// The pull request closes that issue. The test runner writes a JUnit report
// (or, for Go, `go test -json` output).
// This script reads all three and fails, naming the criterion, when:
// - no test's name carries the criterion's number;
// - every test that names it was skipped or failed;
// - the report has no test cases at all, or is missing (rule 9: a check has
//   to prove it ran).
//
// A test names its criterion with the number in capitals, anywhere in its
// name or its suite's: `TestAC3_RefundIsIncome`, `test_AC3_refund_is_income`,
// `it("AC3: a refund is stored as money in")`. AC3 doesn't match AC30.
//
// A pull request that closes no issue, or only issues with no Satisfies
// field, passes with a note: not every change is a slice (dependency updates,
// docs). Dependency-free; Node 20 or later.
//
// Usage: node check-criteria.mjs <report> [more reports …], with GITHUB_TOKEN,
// GITHUB_REPOSITORY and PR_NUMBER set, as in a GitHub Actions job.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The issue form's sections: `### Label` headings and the text under each. */
export function sections(body) {
  const out = {};
  let name = null;
  for (const line of (body ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const m = /^###\s+(.+?)\s*$/.exec(line);
    if (m) {
      name = m[1].toLowerCase();
      out[name] = "";
    } else if (name) out[name] += line + "\n";
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}

/**
 * The criteria a Satisfies field quotes: the AC numbers that start a line
 * (the quoted criteria themselves), or, if none does, every AC number in it.
 */
export function criteria(satisfies) {
  const text = satisfies ?? "";
  const leading = [...text.matchAll(/^[\s>*_-]*(?:\*\*)?(AC\d+)\b/gm)].map(
    (m) => m[1],
  );
  const all = leading.length
    ? leading
    : [...text.matchAll(/\bAC\d+\b/g)].map((m) => m[0]);
  return [...new Set(all)];
}

/** The issues a pull request body closes: "Closes #12", "fixes #3". */
export function closedIssues(body) {
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi;
  return [...new Set([...(body ?? "").matchAll(re)].map((m) => Number(m[1])))];
}

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const attr = (attrs, name) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? decode(m[2] ?? m[3]) : "";
};

/** Every test in `go test -json` output: { name, status }. */
export function goTests(json) {
  const out = new Map();
  for (const line of (json ?? "").split("\n")) {
    if (!line.startsWith("{")) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!e.Test || !["pass", "fail", "skip"].includes(e.Action)) continue;
    const status = { pass: "passed", fail: "failed", skip: "skipped" }[
      e.Action
    ];
    out.set(`${e.Package ?? ""} ${e.Test}`.trim(), status);
  }
  return [...out].map(([name, status]) => ({ name, status }));
}

/**
 * Every test case in a report: JUnit XML (most runners), or `go test -json`
 * output. Each is { name, status }.
 */
export function testCases(xml) {
  if (/^\s*\{/.test(xml ?? "")) return goTests(xml);
  const out = [];
  const re = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of (xml ?? "").matchAll(re)) {
    const body = m[2] ?? "";
    const status = /<(failure|error)\b/.test(body)
      ? "failed"
      : /<skipped\b/.test(body)
        ? "skipped"
        : "passed";
    const name = [attr(m[1], "classname"), attr(m[1], "name")]
      .filter(Boolean)
      .join(" ");
    out.push({ name, status });
  }
  return out;
}

/** Whether a test's name carries a criterion's number: AC3, not AC30. */
export function names(testName, ac) {
  return new RegExp(`(?<![A-Z0-9])${ac}(?![0-9])`).test(testName);
}

/**
 * For each criterion, the tests that name it and how they went, and the
 * problems that fail the check.
 */
export function coverage({ acs, cases }) {
  const rows = acs.map((ac) => {
    const tests = cases.filter((c) => names(c.name, ac));
    const passed = tests.filter((t) => t.status === "passed").length;
    return { ac, tests, passed };
  });
  const problems = [];
  if (acs.length && cases.length === 0)
    problems.push("The test report has no test cases: did the tests run?");
  else
    for (const r of rows) {
      if (r.tests.length === 0) problems.push(`${r.ac}: no test names it.`);
      else if (r.passed === 0) {
        const n = (s) => r.tests.filter((t) => t.status === s).length;
        problems.push(
          `${r.ac}: no test that names it passed (${n("failed")} failed, ${n("skipped")} skipped).`,
        );
      }
    }
  return { rows, problems };
}

async function github(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return res.json();
}

function summary(lines) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, lines.join("\n") + "\n");
}

async function main() {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    PR_NUMBER: pr,
  } = process.env;
  const reports = process.argv.slice(2);
  if (!token || !repo || !/^\d+$/.test(pr ?? "") || reports.length === 0)
    throw new Error(
      "usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo PR_NUMBER=… node check-criteria.mjs <junit.xml> [more.xml …]",
    );

  const pull = await github(`/repos/${repo}/pulls/${pr}`, token);
  const acs = [];
  for (const n of closedIssues(pull.body)) {
    const issue = await github(`/repos/${repo}/issues/${n}`, token);
    const found = criteria(sections(issue.body)["satisfies"]);
    console.log(`#${n} satisfies: ${found.join(", ") || "nothing listed"}`);
    acs.push(...found);
  }
  if (acs.length === 0) {
    console.log(
      "This pull request closes no slice issue with criteria; nothing to check.",
    );
    summary(["### Criteria coverage", "", "No slice criteria to check."]);
    return;
  }

  const cases = [];
  for (const file of reports) {
    if (!existsSync(file))
      throw new Error(`No test report at ${file}: did the tests run?`);
    cases.push(...testCases(readFileSync(file, "utf8")));
  }
  const { rows, problems } = coverage({ acs: [...new Set(acs)], cases });

  summary([
    "### Criteria coverage",
    "",
    "| Criterion | Tests naming it | Passed |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.ac} | ${r.tests.length} | ${r.passed} |`),
  ]);
  for (const r of rows)
    console.log(
      `${r.ac}: ${r.passed} of ${r.tests.length} naming tests passed`,
    );
  if (problems.length) {
    for (const p of problems) console.log(`::error::${p}`);
    process.exit(1);
  }
  console.log("Every criterion has a passing test that names it.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
