#!/usr/bin/env node
// Totals the tokens a set of Claude Code transcripts spent, for a trial's
// cost column: node scripts/session-tokens.mjs <transcript.jsonl>...
//
// Pass every transcript the build produced, its subagents' included (each
// session's JSONL under ~/.claude/projects/, and any subagent files beside
// it). Each assistant reply is counted once, by its message id, because one
// reply can be written over several lines. Cache reads are listed apart from
// fresh input, because they cost about a tenth as much. Each model's replies
// are also totalled apart, since a Haiku token costs a fraction of an Opus one,
// and a subagent pinned to a model only took effect if its replies show that
// model. Each model's line ends with its cost at list price (trial/prices.mjs),
// and the first line with the total. Dependency-free.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { costOf } from "./trial/prices.mjs";

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
      seen.set(row.message.id ?? row.uuid ?? seen.size, {
        usage,
        model: row.message.model ?? "unknown",
      });
    }
  }
  const empty = () => ({
    replies: 0,
    input: 0,
    cacheWrite: 0,
    cacheWrite1h: 0,
    cacheRead: 0,
    output: 0,
  });
  const add = (t, u) => {
    t.replies++;
    t.input += u.input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
    // Part of cacheWrite, priced at twice the input price rather than 1.25x.
    t.cacheWrite1h += u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
  };
  const t = { ...empty(), byModel: {} };
  for (const { usage, model } of seen.values()) {
    add(t, usage);
    add((t.byModel[model] ??= empty()), usage);
  }
  return t;
}

/** Dollars at list price; null when any model has no price row. */
export function cost(t) {
  let sum = 0;
  for (const [model, x] of Object.entries(t.byModel)) {
    const c = costOf(model, x);
    if (c === null) return null;
    sum += c;
  }
  return sum;
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
  const usd = (c) => (c === null ? "no price" : `$${c.toFixed(2)}`);
  const line = (label, x, c) =>
    `${label}replies ${n(x.replies)} · input ${n(x.input)} · cache write ${n(x.cacheWrite)} · cache read ${n(x.cacheRead)} · output ${n(x.output)} · ${usd(c)}`;
  console.log(line("", t, cost(t)));
  for (const [model, x] of Object.entries(t.byModel))
    console.log(line(`  ${model}: `, x, costOf(model, x)));
}
