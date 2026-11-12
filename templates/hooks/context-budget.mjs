#!/usr/bin/env node
// UserPromptSubmit and PostToolUse hook: warns when the session's context has
// grown by more than a budget, 100,000 tokens unless CLAUDE_CONTEXT_BUDGET
// says otherwise (rule 17). After each tool call as well as each message,
// because a session working on its own (a review, an audit, a long run) can
// go far past the budget between two messages: in the third trial, a hook on
// messages alone warned between 138,000 and 208,000 tokens added.
//
// Past that size an agent follows its instructions less closely and decides
// worse, long before the window is full, and compaction carries forward a
// lossy summary rather than the session itself. So the hook tells Claude to
// suggest a handoff and a fresh session at the next natural break, and shows
// the user the same. It warns once on passing the budget and again every
// 50,000 tokens after; a compacted or cleared session starts again.
//
// The size is a main-thread reply's usage in the transcript: what the model
// was sent, plus what it wrote. The budget counts what the session added
// since its first reply, because the harness's own instructions and tools
// arrive before any work and vary widely (about 80,000 tokens in a cloud
// session). After a compaction it counts from the first reply after it. They
// still take attention, so the message gives the total too.
//
// It reads only what the transcript gained since its last run, keeping its
// place and the sizes so far in a small state file, so running after every
// tool call stays cheap however long the session. Never fails or blocks.

import {
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BUDGET = 100_000;
const STEP = 50_000;

const size = (usage) =>
  (usage.input_tokens ?? 0) +
  (usage.cache_read_input_tokens ?? 0) +
  (usage.cache_creation_input_tokens ?? 0) +
  (usage.output_tokens ?? 0);

/**
 * The context size at the session's first main-thread reply since its last
 * compaction, and at its latest one, from the transcript's JSONL text.
 */
export function contextSizes(transcript, from = { start: null, last: null }) {
  let { start, last } = from;
  for (const line of transcript.split("\n")) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row?.type === "system" && row.subtype === "compact_boundary") {
      start = null;
      continue;
    }
    const usage = row?.message?.usage;
    if (row?.type !== "assistant" || row.isSidechain || !usage) continue;
    last = size(usage);
    start ??= last;
  }
  return { start, last };
}

const thousands = (n) => n.toLocaleString("en-GB");
const round = (n) => thousands(Math.round(n / 1000) * 1000);
const short = (n) => `${Math.round(n / 1000)}k`;

/** Whether to warn now, and the step to remember having warned at. */
export function checkBudget({ tokens, start, budget, warnedAt }) {
  const added = tokens - start;
  if (added < budget) return { message: null, warnedAt: null };
  const step = budget + Math.floor((added - budget) / STEP) * STEP;
  if (warnedAt !== null && step <= warnedAt) return { message: null, warnedAt };
  return {
    message:
      `Context check: this session is using about ${round(tokens)} tokens of context, ` +
      `${round(added)} of them added since the session started, past the project's budget of ${thousands(budget)} (rule 17). ` +
      "Past that, agents follow instructions less closely. " +
      "Don't stop in the middle of a step, but at the next natural break tell the user, and suggest writing a handoff " +
      "(/handoff, or update docs/handoff.md) and continuing in a fresh session, rather than carrying on or relying on compaction.",
    warnedAt: step,
  };
}

/** What the transcript gained since `offset`, up to its last complete line. */
function unread(file, offset) {
  const fd = openSync(file, "r");
  try {
    const size = fstatSync(fd).size;
    if (size < offset) return { text: null, size }; // replaced: start again
    const buffer = Buffer.alloc(size - offset);
    readSync(fd, buffer, 0, buffer.length, offset);
    const end = buffer.lastIndexOf(0x0a) + 1;
    return {
      text: buffer.subarray(0, end).toString("utf8"),
      next: offset + end,
    };
  } finally {
    closeSync(fd);
  }
}

function readState(file) {
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    if (state && typeof state.offset === "number") return state;
  } catch {
    // None yet, or from an older version of this hook: start from the top.
  }
  return { offset: 0, start: null, last: null, warnedAt: null };
}

function main() {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const id = String(input.session_id ?? "session").replace(/[^\w-]/g, "_");
    const stateFile = path.join(
      process.env.CONTEXT_BUDGET_STATE_DIR || tmpdir(),
      `claude-context-budget-${id}.json`,
    );
    let state = readState(stateFile);
    let read = unread(input.transcript_path, state.offset);
    if (read.text === null) {
      state = { offset: 0, start: null, last: null, warnedAt: null };
      read = unread(input.transcript_path, 0);
    }
    const sizes = contextSizes(read.text, state);
    state = { ...state, ...sizes, offset: read.next };
    const { start, last: tokens } = sizes;
    if (tokens === null || start === null) {
      writeFileSync(stateFile, JSON.stringify(state));
      return;
    }

    const configured = Number.parseInt(
      process.env.CLAUDE_CONTEXT_BUDGET ?? "",
      10,
    );
    const budget = configured > 0 ? configured : DEFAULT_BUDGET;
    const result = checkBudget({
      tokens,
      start,
      budget,
      warnedAt: state.warnedAt,
    });
    writeFileSync(
      stateFile,
      JSON.stringify({ ...state, warnedAt: result.warnedAt }),
    );
    if (!result.message) return;
    process.stdout.write(
      JSON.stringify({
        systemMessage: `Context is about ${short(tokens)} tokens, ${short(tokens - start)} added this session, past the ${short(budget)} budget. Consider a handoff and a fresh session at the next break.`,
        hookSpecificOutput: {
          hookEventName:
            input.hook_event_name === "PostToolUse"
              ? "PostToolUse"
              : "UserPromptSubmit",
          additionalContext: result.message,
        },
      }),
    );
  } catch {
    // A missing or unreadable transcript just means no warning.
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main();
  process.exit(0);
}
