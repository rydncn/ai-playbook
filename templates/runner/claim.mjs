#!/usr/bin/env node
// Claims the next slice issue an unattended run may take: the oldest open
// issue labelled `slice`, `ready` and `afk`, written by a person in
// HUMAN_APPROVERS, not already `in-progress`, that
// passes check-ticket.mjs again now (its blockers may have reopened since a
// person added `ready`). It labels the issue `in-progress` and writes its
// number to GITHUB_OUTPUT as `issue`, or writes an empty `issue` when nothing
// is ready.
//
// The runner workflow (runner.yml) runs this, then a session on the issue,
// then hands the issue back to a person if the session didn't finish.
// Dependency-free; Node 20 or later.
//
// Usage: node claim.mjs, with GITHUB_TOKEN, GITHUB_REPOSITORY and
// HUMAN_APPROVERS set, and
// check-ticket.mjs next to it (scripts/ in a project).

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLAIMED = "in-progress";

const names = (issue) =>
  (issue.labels ?? []).map((l) =>
    (typeof l === "string" ? l : l.name).toLowerCase(),
  );

/**
 * Whether an issue is a candidate before the ticket check runs. Only issues
 * written by a person in HUMAN_APPROVERS: the issue's body becomes the
 * session's brief, and only its author (or a maintainer) can edit it after
 * `ready` goes on.
 */
export function candidate(issue, approvers) {
  if (issue.pull_request || issue.state !== "open") return false;
  const author = issue.user?.login?.toLowerCase();
  if (!author || issue.user?.type === "Bot" || !approvers.includes(author))
    return false;
  const l = names(issue);
  return (
    ["slice", "ready", "afk"].every((n) => l.includes(n)) &&
    !l.includes("hitl") &&
    !l.includes(CLAIMED)
  );
}

/**
 * The first candidate, oldest first, that passes the ticket check, and the
 * candidates passed over with the reason. `isReady(number)` runs the check.
 */
export function pickNext(issues, isReady, approvers) {
  const skipped = [];
  const queue = issues
    .filter((i) => candidate(i, approvers))
    .sort((a, b) => a.number - b.number);
  for (const issue of queue) {
    const result = isReady(issue.number);
    if (result.ok) return { issue, skipped };
    skipped.push({ number: issue.number, reason: result.output.trim() });
  }
  return { issue: null, skipped };
}

async function github(method, url, token, body) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${url}: ${res.status}`);
  return res.json();
}

function output(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const approvers = (process.env.HUMAN_APPROVERS ?? "")
    .split(/[\s,]+/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  if (approvers.length === 0)
    throw new Error(
      "No approvers: set the HUMAN_APPROVERS repository variable. Only issues they wrote are claimed.",
    );
  if (!token || !repo)
    throw new Error(
      "usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node claim.mjs",
    );

  const issues = await github(
    "GET",
    `/repos/${repo}/issues?state=open&labels=slice,ready,afk&per_page=100&sort=created&direction=asc`,
    token,
  );
  const check = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "check-ticket.mjs",
  );
  const isReady = (n) => {
    const r = spawnSync(process.execPath, [check, String(n)], {
      encoding: "utf8",
      env: process.env,
    });
    return { ok: r.status === 0, output: `${r.stdout}${r.stderr}` };
  };

  const { issue, skipped } = pickNext(issues, isReady, approvers);
  for (const s of skipped)
    console.log(`Passed over #${s.number}:\n${s.reason}`);
  if (!issue) {
    console.log("No slice is ready for an unattended run.");
    output("issue", "");
    return;
  }
  await github("POST", `/repos/${repo}/issues/${issue.number}/labels`, token, {
    labels: [CLAIMED],
  });
  console.log(`Claimed #${issue.number}: ${issue.title}`);
  output("issue", String(issue.number));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
