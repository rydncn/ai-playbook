#!/usr/bin/env node
// The review gate: a required status check that passes only when the pull
// request's current commit has been reviewed, the review found nothing that
// must be fixed, and, for a one-way door, a person has approved this commit.
//
// It makes review a gate rather than advice. The Claude review job reports a
// verdict (must-fix count and its own reading of the door); this script turns
// that verdict into a pass or a fail. The door is decided twice: by the
// reviewer, and by matching the changed files against the one-way paths read
// from the base branch, so a pull request can't take itself off the list.
// Either one saying one-way makes it one-way.
//
// A person approves by either of:
// - an approving review on the current head commit, by a login in
//   HUMAN_APPROVERS;
// - the `human-approved` label, added by a login in HUMAN_APPROVERS. The
//   review workflow removes the label on every push, so it always means
//   "approved since the last commit".
// A person's approval also overrides must-fix findings: that is the ruling
// the review brief asks for when a finding is wrong.
//
// Fails closed: no verdict, an unreadable verdict, or no approvers configured
// is a failure that says what is missing. Dependency-free; Node 20 or later.

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const APPROVAL_LABEL = "human-approved";

/** The one-way paths used when the base branch has no list of its own. */
export const DEFAULT_ONE_WAY = [
  ".claude/**",
  ".mcp.json",
  "**/CLAUDE.md",
  "**/AGENTS.md",
  ".github/**",
  ".devcontainer/**",
  "**/migrations/**",
  "package.json",
  "package-lock.json",
  "go.mod",
  "go.sum",
  "pyproject.toml",
  "uv.lock",
  "Dockerfile",
  "**/Dockerfile",
];

/** A glob (`**`, `*`, `?`) as a regular expression over a repository path. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      const slash = glob[i + 2] === "/";
      re += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  // A pattern ending in a folder name also covers what's inside it.
  return new RegExp(`^${re}(?:/.*)?$`);
}

/** The globs in a one-way paths file: one per line, # for comments. */
export function parsePaths(text) {
  return (
    text
      .split("\n")
      .map((l) => l.replace(/#.*/, "").trim())
      .filter(Boolean)
      // "src/auth/" means the folder: drop the slashes, since a folder name
      // already covers what's inside it.
      .map((l) => l.replace(/^\/|\/$/g, ""))
  );
}

/**
 * The one-way paths in the project file, .claude/playbook.json, as globs:
 * they add to the paths file or the defaults, never replace them. No file
 * means none. A file that can't be read throws, so the gate fails closed
 * rather than quietly dropping the project's own one-way doors.
 */
export function projectPaths(text) {
  if (text == null) return [];
  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    throw new Error(`.claude/playbook.json can't be read: ${error.message}`);
  }
  // A list of globs, or an object from each glob to why it is one-way.
  const given = config?.oneWayPaths ?? [];
  const paths =
    given !== null && typeof given === "object" && !Array.isArray(given)
      ? Object.keys(given)
      : given;
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === "string")) {
    throw new Error(
      '.claude/playbook.json: "oneWayPaths" is a list of globs, or an object from each glob to its reason.',
    );
  }
  return parsePaths(paths.join("\n"));
}

/** The changed files that match a one-way glob. */
export function oneWayFiles(files, globs) {
  const res = globs.map(globToRegExp);
  return files.filter((f) => res.some((re) => re.test(f)));
}

export const VERDICT_MARKER = "<!-- review-gate-verdict";

/**
 * The text of the verdict the review workflow recorded for this commit: the
 * JSON in the latest comment by github-actions[bot] marked with the commit.
 * Only the workflow's own token posts as that account, so neither the pull
 * request's author nor the reviewer can write one.
 */
export function recordedVerdict(comments, head) {
  const mark = `${VERDICT_MARKER} ${head} -->`;
  const c = comments
    .filter(
      (c) =>
        c.user?.login === "github-actions[bot]" && c.body?.startsWith(mark),
    )
    .at(-1);
  if (!c) return "";
  return c.body
    .slice(mark.length)
    .replace(/```(json)?/g, "")
    .trim();
}

/** The verdict from the review's structured output, or an error. */
export function parseVerdict(text) {
  if (!text || !text.trim()) return { error: "the review reported no verdict" };
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return { error: "the review's verdict isn't JSON" };
  }
  if (!Number.isInteger(v?.must_fix) || v.must_fix < 0)
    return { error: "the review's verdict has no must_fix count" };
  if (v.door !== "one-way" && v.door !== "two-way")
    return { error: "the review's verdict doesn't say which door" };
  return { verdict: v };
}

/**
 * Whether a person in the approvers list approved the head commit: an
 * approving review on it, or the approval label, added by them, still on.
 */
export function approval({ head, reviews, labels, labelEvents, approvers }) {
  const ok = (user) =>
    user && user.type !== "Bot" && approvers.includes(user.login.toLowerCase());
  const byReview = reviews.find(
    (r) => r.state === "APPROVED" && r.commit_id === head && ok(r.user),
  );
  if (byReview)
    return `approved by ${byReview.user.login} on ${head.slice(0, 7)}`;
  if (labels.includes(APPROVAL_LABEL)) {
    const added = labelEvents
      .filter((e) => e.event === "labeled" && e.label?.name === APPROVAL_LABEL)
      .at(-1);
    if (added && ok(added.actor))
      return `labelled ${APPROVAL_LABEL} by ${added.actor.login} since the last push`;
  }
  return null;
}

/** The gate's decision: { pass, lines } for the job summary. */
export function decide({ verdictText, files, globs, approvers, ...rest }) {
  const lines = [];
  if (approvers.length === 0)
    return {
      pass: false,
      lines: [
        "Fail: no approvers. Set the HUMAN_APPROVERS repository variable.",
      ],
    };
  const { verdict, error } = parseVerdict(verdictText);
  if (error) {
    // The pull request that adds the review workflow gets no review (the
    // action skips it), so a person's approval stands in for one.
    const by = approval({ approvers, ...rest });
    if (by)
      return { pass: true, lines: [`No review: ${error}.`, `Pass: ${by}.`] };
    return {
      pass: false,
      lines: [
        `Fail: ${error} for this commit. Re-run the review, or a person approves this commit.`,
      ],
    };
  }

  const matched = oneWayFiles(files, globs);
  const oneWay = verdict.door === "one-way" || matched.length > 0;
  lines.push(
    `Must fix: ${verdict.must_fix}. Should fix: ${verdict.should_fix ?? "?"}.`,
  );
  lines.push(
    oneWay
      ? `One-way door (${[verdict.door === "one-way" ? "the reviewer says so" : null, matched.length ? `paths: ${matched.join(", ")}` : null].filter(Boolean).join("; ")}).`
      : "Two-way door.",
  );

  const needsPerson = oneWay || verdict.must_fix > 0;
  if (!needsPerson)
    return {
      pass: true,
      lines: [...lines, "Pass: reviewed, nothing must be fixed."],
    };

  const by = approval({ approvers, ...rest });
  if (by) return { pass: true, lines: [...lines, `Pass: ${by}.`] };
  const why = [
    verdict.must_fix > 0
      ? `fix the ${verdict.must_fix} must-fix finding(s) and push`
      : null,
    oneWay ? "a person reads the one-way files" : null,
  ]
    .filter(Boolean)
    .join(", and ");
  return {
    pass: false,
    lines: [
      ...lines,
      `Fail: ${why}. A person in HUMAN_APPROVERS approves this commit, or adds the ${APPROVAL_LABEL} label.`,
    ],
  };
}

async function github(path, token) {
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
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body)) return body;
    out.push(...body);
    if (body.length < 100) return out;
  }
}

async function main() {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    PR_NUMBER: pr,
  } = process.env;
  const approvers = (process.env.HUMAN_APPROVERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const pull = await github(`/repos/${repo}/pulls/${pr}`, token);
  const head = pull.head.sha;
  const files = (await github(`/repos/${repo}/pulls/${pr}/files`, token)).map(
    (f) => f.filename,
  );
  const reviews = await github(`/repos/${repo}/pulls/${pr}/reviews`, token);
  const comments = await github(`/repos/${repo}/issues/${pr}/comments`, token);
  const verdictText =
    process.env.REVIEW_RESULT === "failure"
      ? ""
      : recordedVerdict(comments, head);
  const labelEvents = await github(`/repos/${repo}/issues/${pr}/events`, token);
  const listed = await github(
    `/repos/${repo}/contents/.github/one-way-paths?ref=${pull.base.sha}`,
    token,
  );
  const project = await github(
    `/repos/${repo}/contents/.claude/playbook.json?ref=${pull.base.sha}`,
    token,
  );
  const globs = [
    ...(listed?.content
      ? parsePaths(Buffer.from(listed.content, "base64").toString("utf8"))
      : DEFAULT_ONE_WAY),
    ...projectPaths(
      project?.content
        ? Buffer.from(project.content, "base64").toString("utf8")
        : null,
    ),
  ];

  const { pass, lines } = decide({
    verdictText,
    files,
    globs,
    approvers,
    head,
    reviews,
    labels: pull.labels.map((l) => l.name),
    labelEvents,
  });
  const summary = process.env.GITHUB_STEP_SUMMARY;
  const text = ["## Review gate", "", ...lines].join("\n");
  if (summary) appendFileSync(summary, text + "\n");
  console.log(text);
  if (!pass) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`Fail: ${e.message}`);
    process.exit(1);
  });
}
