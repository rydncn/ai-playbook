// List prices in US dollars per million tokens, for pricing a trial's tokens
// when all you have is a transcript. The runner itself records the cost the
// Agent SDK reports, which uses the same list prices.
//
// Checked against Anthropic's pricing on 2026-11-25. Prices change: update
// this table, and the date, when they do. A cache read is 0.05x input on Opus
// 5.5 and Sonnet 5.5 and 0.1x elsewhere; a cache write is 1.25x input for the
// 5-minute lifetime and 2x for the 1-hour one. Haiku 5.5's prices are for
// prompts up to 100K tokens; longer prompts cost five times as much, which this
// table doesn't model, so a Haiku figure is a floor.

export const PRICES_CHECKED = "2026-11-25";

export const PRICES = {
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

/** The price row for a model id, ignoring a date suffix or provider prefix. */
export function priceFor(model) {
  if (PRICES[model]) return PRICES[model];
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model.includes(k));
  return key ? PRICES[key] : null;
}

/**
 * Dollars for one model's token totals, as session-tokens.mjs counts them.
 * Cache writes of unknown lifetime are priced at the 5-minute rate, as Claude
 * Code does. Returns null for a model with no price row.
 */
export function costOf(model, t) {
  const p = priceFor(model);
  if (!p) return null;
  const write1h = t.cacheWrite1h ?? 0;
  const write5m = (t.cacheWrite ?? 0) - write1h;
  return (
    (t.input * p.input +
      write5m * p.input * 1.25 +
      write1h * p.input * 2 +
      t.cacheRead * p.cacheRead +
      t.output * p.output) /
    1e6
  );
}
