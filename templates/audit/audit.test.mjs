import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { advisoriesIn, checkAudit, MAX_DAYS } from "./audit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const today = new Date("2026-11-08T12:00:00Z");

// The shape `npm audit --json` (report version 2) produces: an advisory object
// in `via` on the vulnerable package, and the package's name in `via` on each
// package that depends on it.
function report(...advisories) {
  const vulnerabilities = {};
  for (const a of advisories) {
    vulnerabilities[a.pkg] = {
      name: a.pkg,
      severity: a.severity,
      via: [
        {
          source: a.source ?? 1,
          name: a.pkg,
          title: a.title ?? "a problem",
          url: `https://github.com/advisories/${a.id}`,
          severity: a.severity,
        },
      ],
    };
    vulnerabilities[`parent-of-${a.pkg}`] = {
      name: `parent-of-${a.pkg}`,
      severity: a.severity,
      via: [a.pkg],
    };
  }
  return { auditReportVersion: 2, vulnerabilities };
}

const zod = {
  id: "GHSA-mrhx-c7xc-m3w5",
  pkg: "zod",
  severity: "high",
  title: "ReDoS",
};
const entry = (over = {}) => ({
  id: zod.id,
  reason: "Pinned by the build tool; no patched 3.x.",
  expires: "2027-01-31",
  ...over,
});

test("collects each advisory once, by its GHSA id, with the packages it's in", () => {
  const found = advisoriesIn(report(zod));
  assert.deepEqual(found, [
    { id: zod.id, severity: "high", title: "ReDoS", packages: ["zod"] },
  ]);
});

test("a clean report passes", () => {
  assert.deepEqual(checkAudit({ vulnerabilities: {} }, [], today), {
    failures: [],
    allowed: [],
  });
});

test("a high advisory that isn't allowed fails, naming the advisory and package", () => {
  const { failures } = checkAudit(report(zod), [], today);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /GHSA-mrhx-c7xc-m3w5 \(high\) in zod: ReDoS/);
});

test("advisories below the level are ignored; critical counts at level high", () => {
  const low = { id: "GHSA-low0-0000-0000", pkg: "a", severity: "moderate" };
  const crit = { id: "GHSA-crit-0000-0000", pkg: "b", severity: "critical" };
  const { failures } = checkAudit(report(low, crit), [], today);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /GHSA-crit/);
  assert.equal(
    checkAudit(report(zod), [], today, { level: "critical" }).failures.length,
    0,
  );
});

test("an allowed advisory passes and is reported with its reason and expiry", () => {
  const { failures, allowed } = checkAudit(report(zod), [entry()], today);
  assert.deepEqual(failures, []);
  assert.match(
    allowed[0],
    /Allowed until 2027-01-31: Pinned by the build tool/,
  );
});

test("an expired entry fails, even though it matches", () => {
  const { failures } = checkAudit(
    report(zod),
    [entry({ expires: "2026-11-07" })],
    today,
  );
  assert.equal(
    failures.length,
    2,
    "the expired entry, and the advisory it no longer covers",
  );
  assert.match(failures[0], /expired on 2026-11-07/);
});

test("an entry that expires today still holds", () => {
  assert.deepEqual(
    checkAudit(report(zod), [entry({ expires: "2026-11-08" })], today).failures,
    [],
  );
});

test("an entry that no longer matches any advisory fails, so the list can't rot", () => {
  const { failures } = checkAudit({ vulnerabilities: {} }, [entry()], today);
  assert.deepEqual(failures, [
    `Allowlist: ${zod.id} no longer matches any advisory. Remove it.`,
  ]);
});

test("entries need a reason and a real date no more than MAX_DAYS ahead", () => {
  const far = new Date(today.getTime() + (MAX_DAYS + 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  for (const [bad, message] of [
    [entry({ reason: " " }), /has no reason/],
    [entry({ expires: undefined }), /needs an expiry date/],
    [entry({ expires: "2027-02-30" }), /needs an expiry date/],
    [entry({ expires: far }), /more than 180 days ahead/],
    [{ reason: "x", expires: "2027-01-01" }, /has no id/],
  ]) {
    const { failures } = checkAudit(report(zod), [bad], today);
    assert.match(failures[0], message);
    assert.ok(
      failures.some((f) => f.includes(zod.id)),
      "the advisory itself still fails",
    );
  }
});

// End to end: the script as CI runs it, on a saved report.

function run(reportJson, allowlist) {
  const dir = mkdtempSync(path.join(tmpdir(), "audit-"));
  writeFileSync(path.join(dir, "report.json"), JSON.stringify(reportJson));
  const args = [
    path.join(here, "audit.mjs"),
    "--report",
    path.join(dir, "report.json"),
  ];
  if (allowlist) {
    writeFileSync(path.join(dir, "allow.json"), JSON.stringify(allowlist));
    args.splice(1, 0, path.join(dir, "allow.json"));
  }
  return spawnSync("node", args, { encoding: "utf8" });
}

test("the script exits 1 on an advisory outside the allowlist and 0 once it's allowed", () => {
  const failing = run(report(zod));
  assert.equal(failing.status, 1);
  assert.match(failing.stderr, /FAIL: GHSA-mrhx-c7xc-m3w5/);
  const expires = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const passing = run(report(zod), [entry({ expires })]);
  assert.equal(passing.status, 0, passing.stderr);
  assert.match(passing.stdout, /allowed: GHSA-mrhx-c7xc-m3w5/);
});

test("the script exits 2 when npm audit itself failed", () => {
  const broken = run({ error: { summary: "no lockfile" } });
  assert.equal(broken.status, 2);
  assert.match(broken.stderr, /npm audit failed: no lockfile/);
});
