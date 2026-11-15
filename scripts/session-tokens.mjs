#!/usr/bin/env node
// Totals the tokens a set of Claude Code transcripts spent, for a trial's
// cost column: node scripts/session-tokens.mjs <transcript.jsonl>...
//
// Pass every transcript the build produced, its subagents' included (each
// session's JSONL under ~/.claude/projects/, and any subagent files beside
// it). Each assistant reply is counted once, by its message id, because one
// reply can be written over several lines. Cache reads are listed apart from
// fresh input, because they cost about a tenth as much. Dependency-free.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function totals(texts) {
  const seen = new Map();
  for (const text of texts) {
    for (const line of text.split("\n")) {
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const usage = row?.message?.usage;
      if (row?.type !== "assistant" || !usage) continue;
      // The last line of a reply carries its final usage.
      seen.set(row.message.id ?? row.uuid ?? seen.size, usage);
    }
  }
  const t = { replies: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  for (const u of seen.values()) {
    t.replies++;
    t.input += u.input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
  }
  return t;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error(
      "usage: node scripts/session-tokens.mjs <transcript.jsonl>...",
    );
    process.exit(1);
  }
  const t = totals(files.map((f) => readFileSync(f, "utf8")));
  const n = (x) => x.toLocaleString("en-GB");
  console.log(
    `replies ${n(t.replies)} · input ${n(t.input)} · cache write ${n(t.cacheWrite)} · cache read ${n(t.cacheRead)} · output ${n(t.output)}`,
  );
}
