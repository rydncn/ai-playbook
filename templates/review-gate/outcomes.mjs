#!/usr/bin/env node
// What happened after the gate: for the pull requests merged in a window,
// how many were later reverted or blamed for a regression, split by how the
// gate let them through. The gate decides before a merge; this is the only
// part of the playbook that looks at what came after, and the only evidence
// that letting two-way doors merge on the automated layers alone is safe.
//
// Each merged pull request is put in one of three groups:
// - automated: the review's last verdict was a two-way door with nothing to
//   fix, and no person approved it;
// - person: a login in HUMAN_APPROVERS approved it, by an approving review or
//   the `human-approved` label;
// - unreviewed: no verdict was recorded (the review didn't run, or it was
//   merged before the gate existed).
//
// A pull request counts as an escape when, later in the window:
// - a commit on the default branch says "This reverts commit <sha>" for one
//   of its commits or its merge commit, or a merged pull request says
//   "Reverts <owner>/<repo>#<n>" (GitHub's Revert button writes both); or
// - an issue labelled `regression` says "Caused by #<n>".
//
// It fails, as a kill switch, when the automated group's escape rate is over
// MAX_ESCAPE_RATE (default 0.05) with at least MIN_SAMPLE (default 20)
// pull requests in it: past that, two-way doors go back to needing a person
// until the cause has a check. Vercel set its own switch at three times its
// baseline revert rate before letting any pull request merge unreviewed.
// Dependency-free; Node 20 or later.

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// The gate's own reading of verdicts and approvals, so the two never
// disagree: scripts/review-gate.mjs in a project, gate.mjs in the template.
const gate = await import("./review-gate.mjs").catch(
  () => import("./gate.mjs"),
);
const { approval, parseVerdict, VERDICT_MARKER } = gate;

/** The last verdict the review workflow recorded on a pull request, any commit. */
export function lastVerdict(comments) {
  const c = comments
    .filter(
      (c) =>
        c.user?.login === "github-actions[bot]" &&
        c.body?.startsWith(VERDICT_MARKER),
    )
    .at(-1);
  if (!c) return null;
  const text = c.body
    .replace(/^<!-- review-gate-verdict [0-9a-f]+ -->/, "")
    .replace(/```(json)?/g, "")
    .trim();
  return parseVerdict(text).verdict ?? null;
}

/**
 * Which group a merged pull request is in. `approved` is whether a person in
 * the approvers list approved its last commit.
 */
export function group({ verdict, approved }) {
  if (approved) return "person";
  if (!verdict) return "unreviewed";
  if (verdict.door === "two-way" && verdict.must_fix === 0) return "automated";
  // A one-way door or a must-fix merged with no approval: the gate was red.
  return "unreviewed";
}

/** The pull request numbers and commit shas a text says it reverts or blames. */
export function blamed(text, repo) {
  const prs = new Set();
  const shas = new Set();
  const escaped = repo.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  for (const m of text.matchAll(
    new RegExp(`Reverts (?:${escaped})?#(\\d+)`, "gi"),
  ))
    prs.add(Number(m[1]));
  for (const m of text.matchAll(/Caused by #(\d+)/gi)) prs.add(Number(m[1]));
  for (const m of text.matchAll(/This reverts commit ([0-9a-f]{7,40})/gi))
    shas.add(m[1].toLowerCase());
  return { prs, shas };
}

/**
 * The table of outcomes: per group, how many merged and how many escaped,
 * and whether the kill switch trips.
 * `merged`: [{ number, group, shas: [commit and merge shas] }].
 * `texts`: revert commit messages, revert pull request bodies and regression
 * issue bodies.
 */
export function outcomes({
  merged,
  texts,
  repo,
  maxRate = 0.05,
  minSample = 20,
}) {
  const prs = new Set();
  const shas = new Set();
  for (const t of texts) {
    const b = blamed(t, repo);
    b.prs.forEach((n) => prs.add(n));
    b.shas.forEach((s) => shas.add(s));
  }
  const escaped = (pr) =>
    prs.has(pr.number) ||
    pr.shas.some((s) =>
      [...shas].some((short) => s.toLowerCase().startsWith(short)),
    );
  const groups = {};
  for (const name of ["automated", "person", "unreviewed"])
    groups[name] = { merged: 0, escaped: [] };
  for (const pr of merged) {
    const g = groups[pr.group];
    g.merged++;
    if (escaped(pr)) g.escaped.push(pr.number);
  }
  const auto = groups.automated;
  const rate = auto.merged ? auto.escaped.length / auto.merged : 0;
  const tripped = auto.merged >= minSample && rate > maxRate;
  return { groups, rate, tripped };
}

/** The job summary, in Markdown. */
export function report(
  { groups, rate, tripped },
  { days, maxRate, minSample },
) {
  const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "–");
  const lines = [
    `## Outcomes after the gate, last ${days} days`,
    "",
    "| How it merged | Merged | Reverted or blamed | Rate | Which |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [name, g] of Object.entries(groups))
    lines.push(
      `| ${name} | ${g.merged} | ${g.escaped.length} | ${pct(g.escaped.length, g.merged)} | ${g.escaped.map((n) => `#${n}`).join(", ")} |`,
    );
  lines.push("");
  if (tripped)
    lines.push(
      `Fail: ${pct(groups.automated.escaped.length, groups.automated.merged)} of automated merges escaped, over the ${(maxRate * 100).toFixed(1)}% limit. Until the cause has a check, have a person approve two-way doors too, by adding \`**\` to \`.github/one-way-paths\`.`,
    );
  else if (groups.automated.merged < minSample)
    lines.push(
      `Too few automated merges to judge (${groups.automated.merged} of the ${minSample} needed).`,
    );
  else
    lines.push(
      `Pass: automated merges escaped at ${(rate * 100).toFixed(1)}%, within the ${(maxRate * 100).toFixed(1)}% limit.`,
    );
  return lines.join("\n");
}

async function github(path, token, { until } = {}) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(
      `https://api.github.com${path}${sep}per_page=100&page=${page}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
      },
    );
    if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) return body;
    out.push(...body);
    if (body.length < 100 || (until && until(body.at(-1)))) return out;
  }
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const days = Number(process.env.WINDOW_DAYS || 90);
  const maxRate = Number(process.env.MAX_ESCAPE_RATE || 0.05);
  const minSample = Number(process.env.MIN_SAMPLE || 20);
  const approvers = (process.env.HUMAN_APPROVERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const info = await github(`/repos/${repo}`, token);
  const base = info.default_branch;
  const closed = await github(
    `/repos/${repo}/pulls?state=closed&base=${base}&sort=updated&direction=desc`,
    token,
    { until: (p) => p.updated_at < since },
  );
  const pulls = closed.filter((p) => p.merged_at && p.merged_at >= since);
  // A revert is counted against what it reverts, not as a merge of its own.
  const isRevert = (p) => /^Revert "/.test(p.title);

  const merged = [];
  const texts = [];
  for (const p of pulls) {
    const n = p.number;
    texts.push(`${p.title}\n${p.body ?? ""}`);
    if (isRevert(p)) continue;
    const comments = await github(`/repos/${repo}/issues/${n}/comments`, token);
    const reviews = await github(`/repos/${repo}/pulls/${n}/reviews`, token);
    const events = await github(`/repos/${repo}/issues/${n}/events`, token);
    const commits = await github(`/repos/${repo}/pulls/${n}/commits`, token);
    const approved = Boolean(
      approval({
        head: p.head.sha,
        reviews,
        labels: p.labels.map((l) => l.name),
        labelEvents: events,
        approvers,
      }),
    );
    merged.push({
      number: n,
      group: group({ verdict: lastVerdict(comments), approved }),
      shas: [p.merge_commit_sha, ...commits.map((c) => c.sha)].filter(Boolean),
    });
  }
  const onBase = await github(
    `/repos/${repo}/commits?sha=${base}&since=${since}`,
    token,
  );
  texts.push(...onBase.map((c) => c.commit.message));
  const issues = await github(
    `/repos/${repo}/issues?labels=regression&state=all&since=${since}`,
    token,
  );
  texts.push(...issues.map((i) => i.body ?? ""));

  const result = outcomes({ merged, texts, repo, maxRate, minSample });
  const text = report(result, { days, maxRate, minSample });
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  console.log(text);
  if (result.tripped) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`Fail: ${e.message}`);
    process.exit(1);
  });
}
