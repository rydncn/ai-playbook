#!/usr/bin/env node
// Dependency audit with a dated allowlist. Runs `npm audit --json` and fails
// on any high or critical advisory that isn't on the allowlist.
//
// `npm audit` has no ignore list, so an advisory nobody can fix yet (a
// framework pinning a vulnerable version of a build tool, say) turns the gate
// red from day one, and a gate that's always red stops being read. The
// allowlist fixes that without letting it rot: every entry needs a reason and
// an expiry no more than MAX_DAYS ahead, and the check also fails on an
// expired entry and on an entry that no longer matches any advisory.
//
// Usage: node audit.mjs [allowlist.json] [--level high|critical]
//                       [--report audit.json]  (a saved report, for testing)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_DAYS = 180;
const LEVELS = ["info", "low", "moderate", "high", "critical"];
const DAY = 24 * 60 * 60 * 1000;

/** Every advisory in an `npm audit --json` report (v2), keyed by its GHSA id or npm number. */
export function advisoriesIn(report) {
  const found = new Map();
  for (const vuln of Object.values(report?.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== "object" || via === null) continue; // a string names another package
      const ghsa =
        typeof via.url === "string"
          ? via.url.match(/GHSA-[\w-]+/)?.[0]
          : undefined;
      const id = ghsa ?? String(via.source);
      if (!found.has(id)) {
        found.set(id, {
          id,
          severity: via.severity,
          title: via.title ?? "",
          packages: new Set(),
        });
      }
      found.get(id).packages.add(via.name ?? vuln.name);
    }
  }
  return [...found.values()].map((a) => ({
    ...a,
    packages: [...a.packages].sort(),
  }));
}

function parseDay(text) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text))
    return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text
    ? null
    : date;
}

/** Compares the report with the allowlist. Returns what fails and what was allowed. */
export function checkAudit(report, allowlist, today, { level = "high" } = {}) {
  const failures = [];
  const allowed = [];
  const threshold = LEVELS.indexOf(level);
  const day = parseDay(today.toISOString().slice(0, 10));
  const advisories = advisoriesIn(report);
  const ids = new Set(advisories.map((a) => a.id));
  const entries = new Map();

  for (const entry of Array.isArray(allowlist) ? allowlist : []) {
    const label = entry?.id ?? "(an entry with no id)";
    const expires = parseDay(entry?.expires);
    if (!entry?.id) failures.push("Allowlist: an entry has no id.");
    else if (typeof entry.reason !== "string" || entry.reason.trim() === "")
      failures.push(`Allowlist: ${label} has no reason.`);
    else if (!expires)
      failures.push(`Allowlist: ${label} needs an expiry date as YYYY-MM-DD.`);
    else if (expires < day)
      failures.push(
        `Allowlist: ${label} expired on ${entry.expires}. Check it again, then fix it or renew the entry.`,
      );
    else if ((expires - day) / DAY > MAX_DAYS)
      failures.push(
        `Allowlist: ${label} expires more than ${MAX_DAYS} days ahead (${entry.expires}).`,
      );
    else if (!ids.has(entry.id))
      failures.push(
        `Allowlist: ${label} no longer matches any advisory. Remove it.`,
      );
    else entries.set(entry.id, entry);
  }

  for (const advisory of advisories) {
    if (LEVELS.indexOf(advisory.severity) < threshold) continue;
    const where = `${advisory.id} (${advisory.severity}) in ${advisory.packages.join(", ")}: ${advisory.title}`;
    if (entries.has(advisory.id))
      allowed.push(
        `${where}. Allowed until ${entries.get(advisory.id).expires}: ${entries.get(advisory.id).reason}`,
      );
    else failures.push(where);
  }
  return { failures, allowed };
}

function main(argv) {
  const args = [...argv];
  const option = (name) => {
    const i = args.indexOf(name);
    if (i === -1) return undefined;
    const [, value] = args.splice(i, 2);
    return value;
  };
  const level = option("--level") ?? "high";
  const reportFile = option("--report");
  const allowlistFile = args[0] ?? "scripts/audit-allowlist.json";

  if (!LEVELS.includes(level)) {
    console.error(
      `Unknown level "${level}". Use one of: ${LEVELS.join(", ")}.`,
    );
    return 2;
  }

  let reportText;
  if (reportFile) reportText = readFileSync(reportFile, "utf8");
  else {
    // npm exits non-zero when it finds anything, so read its output either way.
    const run = spawnSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    reportText = run.stdout;
  }

  let report;
  try {
    report = JSON.parse(reportText);
  } catch {
    console.error(
      "Couldn't read npm audit's output as JSON. Is there a lockfile, and can npm reach the registry?",
    );
    return 2;
  }
  if (report.error) {
    console.error(
      `npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`,
    );
    return 2;
  }

  const allowlist = existsSync(allowlistFile)
    ? JSON.parse(readFileSync(allowlistFile, "utf8"))
    : [];
  const { failures, allowed } = checkAudit(report, allowlist, new Date(), {
    level,
  });
  for (const line of allowed) console.log(`allowed: ${line}`);
  for (const line of failures) console.error(`FAIL: ${line}`);
  if (failures.length === 0)
    console.log(`No ${level} or worse advisories outside the allowlist.`);
  return failures.length === 0 ? 0 : 1;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.exit(main(process.argv.slice(2)));
}
