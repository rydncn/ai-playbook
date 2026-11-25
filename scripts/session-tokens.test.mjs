import { test } from "node:test";
import assert from "node:assert/strict";
import { cost, totals } from "./session-tokens.mjs";

const reply = (id, usage) =>
  JSON.stringify({ type: "assistant", message: { id, usage } });

test("each reply counts once, with its last usage, across files", () => {
  const a = [
    reply("m1", { input_tokens: 10, output_tokens: 1 }),
    reply("m1", {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 100,
    }),
    JSON.stringify({ type: "user", message: { content: "hi" } }),
    "not json",
  ].join("\n");
  const b = reply("m2", {
    input_tokens: 3,
    cache_creation_input_tokens: 50,
    output_tokens: 2,
  });
  const { byModel, ...all } = totals([a, b]);
  assert.deepEqual(all, {
    replies: 2,
    input: 13,
    cacheWrite: 50,
    cacheWrite1h: 0,
    cacheRead: 100,
    output: 7,
  });
});

test("each model's replies are totalled apart, so a pinned subagent model shows it took effect", () => {
  const row = (id, model, usage) =>
    JSON.stringify({ type: "assistant", message: { id, model, usage } });
  const t = totals([
    [
      row("m1", "claude-opus-5-5", { input_tokens: 10, output_tokens: 4 }),
      row("m2", "claude-haiku-5-5", { input_tokens: 2, output_tokens: 1 }),
      row("m2", "claude-haiku-5-5", { input_tokens: 2, output_tokens: 3 }),
      reply("m3", { input_tokens: 1, output_tokens: 1 }),
    ].join("\n"),
  ]);
  assert.equal(t.replies, 3);
  assert.deepEqual(t.byModel, {
    "claude-opus-5-5": {
      replies: 1,
      input: 10,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 0,
      output: 4,
    },
    "claude-haiku-5-5": {
      replies: 1,
      input: 2,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 0,
      output: 3,
    },
    unknown: {
      replies: 1,
      input: 1,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 0,
      output: 1,
    },
  });
});

test("cost prices each model apart, and 1-hour cache writes at twice input", () => {
  const row = (id, model, usage) =>
    JSON.stringify({ type: "assistant", message: { id, model, usage } });
  const t = totals([
    [
      row("m1", "claude-opus-5-5", {
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
        cache_creation_input_tokens: 2_000_000,
        cache_creation: { ephemeral_1h_input_tokens: 1_000_000 },
      }),
      row("m2", "claude-haiku-5-5", { input_tokens: 1_000_000 }),
    ].join("\n"),
  ]);
  assert.equal(t.byModel["claude-opus-5-5"].cacheWrite1h, 1_000_000);
  // Opus 5.5: 4 input + 20 output + 0.2 read + 5 (5m write) + 8 (1h write);
  // Haiku 5.5: 0.1 input.
  assert.equal(cost(t).toFixed(2), "37.30");
});

test("cost is null when a model has no price, rather than a low total", () => {
  const t = totals([
    JSON.stringify({
      type: "assistant",
      message: { id: "m1", model: "mystery", usage: { input_tokens: 5 } },
    }),
  ]);
  assert.equal(cost(t), null);
});
