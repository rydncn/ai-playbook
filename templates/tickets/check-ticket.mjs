#!/usr/bin/env node
// Says whether a slice issue is ready for an agent to start: the definition
// of agent-ready, as a check rather than a judgement. A person runs it before
// adding the `ready` label; a runner runs it before claiming the issue.
//
// Ready means:
// - it quotes the acceptance criteria it satisfies, with their numbers;
// - it names the design sections it needs;
// - every task says how its effect is observed, and has a failing test to
//   write first (or, for a spike, what it measures);
// - a command decides when it's done;
// - its door is decided, and a one-way door names its files;
// - exactly one of `afk` and `hitl` is on it;
// - nothing it is blocked by is still open.
//
// Usage: node check-ticket.mjs <issue number>, with GITHUB_TOKEN and
// GITHUB_REPOSITORY set (as in a GitHub Actions job). Prints each problem and
// exits 1 when the issue isn't ready. Dependency-free; Node 20 or later.

import { fileURLToPath } from "node:url";

const EMPTY = /^(_no response_|none|n\/a|-)?$/i;

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

/** The tasks under Tasks: { title, text } per `Task N:` heading. */
export function tasks(text) {
  const parts = (text ?? "").split(/^#{2,6}\s+(?=Task\s+\d+\s*:)/im).slice(1);
  return parts.map((p) => {
    const [first, ...rest] = p.split("\n");
    return { title: first.trim(), text: rest.join("\n") };
  });
}

/** The value after a bold field name in a task, such as **Observed by:**. */
export function field(text, name) {
  const re = new RegExp(`\\*\\*${name}:?\\*\\*:?\\s*(.*)`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const v = m[1].trim();
  return v && !/^<[^>]*>$/.test(v) ? v : "";
}

/** Issue numbers in a Blocked by value. */
export function blockers(text) {
  const t = (text ?? "").trim();
  if (EMPTY.test(t)) return [];
  return [...t.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

const filled = (v) =>
  v != null && !EMPTY.test(v.trim()) && !/^<[^>]*>$/.test(v.trim());

/**
 * The problems that stop an issue being ready, given its body, its labels and
 * the issue numbers among its blockers that are still open.
 */
export function problems({ body, labels, openBlockers = [] }) {
  const s = sections(body);
  const out = [];

  if (!filled(s["satisfies"]) || !/\bAC\d+\b/.test(s["satisfies"]))
    out.push(
      "Satisfies: quote the acceptance criteria with their numbers (AC1, AC2…).",
    );
  if (!filled(s["design sections"]))
    out.push("Design sections: name the headings this slice needs.");

  const list = tasks(s["tasks"]);
  if (list.length === 0)
    out.push("Tasks: add at least one `#### Task N: <behaviour>`.");
  for (const t of list) {
    const spike = field(t.text, "Measure") != null;
    if (spike) {
      const say = {
        Measure: "what it measures",
        Record: "where the numbers go",
        Decides: "what the result decides",
      };
      for (const [f, what] of Object.entries(say))
        if (!field(t.text, f))
          out.push(`${t.title}: a spike says ${what} (**${f}:**).`);
      continue;
    }
    if (!field(t.text, "Test"))
      out.push(`${t.title}: name the failing test written first (**Test:**).`);
    if (!field(t.text, "Observed by"))
      out.push(
        `${t.title}: say how its effect is observed (**Observed by:**).`,
      );
  }

  if (!filled(s["done when"]))
    out.push(
      "Done when: give the command whose success means the slice is done.",
    );

  const door = (s["door"] ?? "").toLowerCase();
  if (door !== "one-way" && door !== "two-way")
    out.push("Door: choose one-way or two-way.");
  if (door === "one-way" && !filled(s["one-way files"]))
    out.push("One-way files: a one-way door names the files that make it one.");

  const names = labels.map((l) => l.toLowerCase());
  const modes = ["afk", "hitl"].filter((m) => names.includes(m));
  if (modes.length !== 1)
    out.push(
      "Labels: exactly one of `afk` (may run unattended) and `hitl` (needs a person).",
    );

  if (!("blocked by" in s))
    out.push('Blocked by: say "None", or list the issues.');
  for (const n of openBlockers)
    out.push(`Blocked by #${n}, which is still open.`);
  return out;
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

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const number = process.argv[2];
  if (!token || !repo || !/^\d+$/.test(number ?? ""))
    throw new Error(
      "usage: GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node check-ticket.mjs <issue number>",
    );
  const issue = await github(`/repos/${repo}/issues/${number}`, token);
  const listed = blockers(sections(issue.body)["blocked by"]);
  const openBlockers = [];
  for (const n of listed) {
    const b = await github(`/repos/${repo}/issues/${n}`, token);
    if (b.state !== "closed") openBlockers.push(n);
  }
  const found = problems({
    body: issue.body,
    labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
    openBlockers,
  });
  if (found.length === 0) {
    console.log(`#${number} is ready.`);
    return;
  }
  console.log(`#${number} isn't ready:`);
  for (const p of found) console.log(`- ${p}`);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
