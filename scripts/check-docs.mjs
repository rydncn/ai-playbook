#!/usr/bin/env node
// Checks that the playbook's documents agree with each other and with the
// files they describe (rule 12: a rule broken twice becomes a check). The
// documents changed often, and stale copies went unnoticed: the
// setup skill said to copy four hooks when there were six, and VERIFICATION.md
// named four review questions after REVIEW.md had five.
//
// It checks three things:
// - every relative Markdown link points at a file that exists, and every
//   #anchor at a heading in it;
// - every "<number> questions" matches the count in templates/REVIEW.md;
// - every "Copy all <number> files" matches the files in templates/hooks.
//
// The CHANGELOG is history, so it is checked for links only. Exits 1 with one
// line per problem.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** GitHub's anchor for a heading. */
export function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

/** The anchors a Markdown document's headings produce. */
export function anchors(markdown) {
  const seen = new Map();
  const out = new Set();
  for (const line of withoutCode(markdown).split("\n")) {
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slug(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

/** The text with fenced code blocks and inline code blanked out. */
export function withoutCode(markdown) {
  return markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/`[^`\n]*`/g, "``");
}

/** Relative links in a Markdown document: { target, anchor }. */
export function links(markdown) {
  const out = [];
  for (const m of withoutCode(markdown).matchAll(
    /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
  )) {
    const href = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // http:, mailto: and the like
    const [target, anchor] = href.split("#");
    out.push({ target, anchor: anchor ?? null });
  }
  return out;
}

/** Problems with one document's relative links. */
export function brokenLinks(file, markdown, { exists, read }) {
  const problems = [];
  for (const { target, anchor } of links(markdown)) {
    const resolved = target
      ? path.join(path.dirname(file), decodeURI(target))
      : file;
    if (!exists(resolved)) {
      problems.push(`${file}: link to ${target} points at nothing`);
      continue;
    }
    if (
      anchor &&
      resolved.endsWith(".md") &&
      !anchors(read(resolved)).has(anchor)
    ) {
      problems.push(
        `${file}: link to ${target || ""}#${anchor} has no matching heading`,
      );
    }
  }
  return problems;
}

/** The number of questions REVIEW.md asks by name: the bold bullets under item 2. */
export function reviewQuestionCount(reviewMarkdown) {
  const start = reviewMarkdown.indexOf("2. **The five questions");
  const fallback = reviewMarkdown.search(/^2\. /m);
  const from = start >= 0 ? start : fallback;
  if (from < 0) return 0;
  const rest = reviewMarkdown.slice(from).split("\n").slice(1);
  let count = 0;
  for (const line of rest) {
    if (/^\s+- \*\*/.test(line)) count++;
    else if (/^\d+\. /.test(line)) break;
  }
  return count;
}

/** Each "<number> questions" in the text that isn't the given count. */
export function wrongQuestionCounts(file, markdown, count) {
  const problems = [];
  const words = NUMBERS.join("|");
  const re = new RegExp(
    `(?<!first |last |other )\\b(${words})( review)? questions\\b`,
    "gi",
  );
  for (const m of withoutCode(markdown).matchAll(re)) {
    const n = NUMBERS.indexOf(m[1].toLowerCase());
    if (n !== count)
      problems.push(
        `${file}: says "${m[0]}", but templates/REVIEW.md asks ${NUMBERS[count]}`,
      );
  }
  return problems;
}

/** Each "Copy all <number> files" in the text that isn't the given count. */
export function wrongHookCounts(file, markdown, count) {
  const problems = [];
  const re = new RegExp(`Copy all (${NUMBERS.join("|")}|\\d+)\\b`, "gi");
  for (const m of markdown.matchAll(re)) {
    const word = m[1].toLowerCase();
    const n = /^\d+$/.test(word) ? Number(word) : NUMBERS.indexOf(word);
    if (n !== count)
      problems.push(
        `${file}: says "${m[0]}", but templates/hooks has ${NUMBERS[count] ?? count} files to copy`,
      );
  }
  return problems;
}

/** The files a project copies from templates/hooks: all but the docs, tests and settings. */
export function hookFiles(names) {
  return names.filter(
    (n) =>
      n !== "README.md" &&
      n !== "settings.hooks.json" &&
      !/\.test\.m?js$/.test(n),
  );
}

function markdownFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...markdownFiles(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function checkRepository(root) {
  const rel = (p) => path.relative(root, p);
  const read = (p) => readFileSync(path.join(root, p), "utf8");
  const exists = (p) => existsSync(path.join(root, p));
  const questions = reviewQuestionCount(read("templates/REVIEW.md"));
  const hooks = hookFiles(
    readdirSync(path.join(root, "templates/hooks")),
  ).length;
  const problems = [];
  if (questions === 0)
    problems.push("templates/REVIEW.md: found no review questions to count");
  for (const abs of markdownFiles(root)) {
    const file = rel(abs);
    const text = read(file);
    problems.push(...brokenLinks(file, text, { exists, read }));
    if (file === "CHANGELOG.md") continue;
    problems.push(...wrongQuestionCounts(file, text, questions));
    problems.push(...wrongHookCounts(file, text, hooks));
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const problems = checkRepository(root);
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(
    "Documents agree: links resolve, question and hook counts match.",
  );
}
