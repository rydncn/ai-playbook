// Run with: node --test templates/rule-check/check-rules.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  blankComments,
  compile,
  checkSource,
  checkJsonValues,
  checkRepo,
} = require("./check-rules");

const EXAMPLE = path.join(__dirname, "rules.example.json");
const rules = JSON.parse(fs.readFileSync(EXAMPLE, "utf8"));
const rule = (id) => compile(rules.find((r) => r.id === id));
const lines = (hits) => hits.map((h) => h.line);

function tempRepo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rule-check-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test("flags direct queries on any client name", () => {
  const src = [
    'await supabase.from("profiles").select()',
    "client.from('orders')",
    'await db.rpc("approve")',
  ].join("\n");
  assert.deepEqual(
    lines(checkSource(rule("no-direct-db"), src, "hooks/x.ts")),
    [1, 2, 3],
  );
});

test("flags a call a formatter has split across lines, at the line it starts", () => {
  const src = [
    "const { data } = await supabase",
    '  .from("profiles")',
    "  .select();",
  ].join("\n");
  assert.deepEqual(
    lines(checkSource(rule("no-direct-db"), src, "hooks/x.ts")),
    [1],
  );
});

test("flags table names held in constants and hyphenated names", () => {
  const src = [
    "supabase.from(PROFILES_TABLE)",
    'supabase.from("audit-log")',
  ].join("\n");
  assert.deepEqual(
    lines(checkSource(rule("no-direct-db"), src, "hooks/x.ts")),
    [1, 2],
  );
});

test("allows built-ins that share the method name, even split across lines", () => {
  const src = [
    'Array.from("abc")',
    'Buffer.from("aGk=")',
    "Array.from(set)",
    "Array",
    '  .from("x")',
  ].join("\n");
  assert.deepEqual(checkSource(rule("no-direct-db"), src, "src/x.ts"), []);
});

test("ignores line, block and JSX comments", () => {
  const src = [
    "// never call supabase.from('x') here",
    "/* old: supabase.from('x')",
    "   db.rpc('y') */",
    "<View>{/* supabase.from('x') */}</View>",
  ].join("\n");
  assert.deepEqual(checkSource(rule("no-direct-db"), src, "src/x.tsx"), []);
});

test("does not treat code starting with # as a comment", () => {
  const src = 'class A { #q = supabase.from("users"); }';
  assert.deepEqual(
    lines(checkSource(rule("no-direct-db"), src, "src/x.ts")),
    [1],
  );
});

test("keeps strings intact while blanking comments, and survives JSX apostrophes", () => {
  assert.equal(
    blankComments('const u = "https://x.io"; // note'),
    'const u = "https://x.io";        ',
  );
  const src = [
    "<Text>Don't park here</Text>;",
    "// supabase.from('x')",
    'supabase.from("y")',
  ].join("\n");
  assert.deepEqual(
    lines(checkSource(rule("no-direct-db"), src, "src/x.tsx")),
    [3],
  );
});

test("honours a reasoned ignore marker on the line the match starts", () => {
  const src = 'db.rpc("x") // rules-check-ignore: one-off migration script';
  assert.deepEqual(checkSource(rule("no-direct-db"), src, "src/x.ts"), []);
});

test("reports one hit per line even with several matches", () => {
  const hits = checkSource(
    rule("no-console-log"),
    "console.log(a); console.log(b);",
    "src/x.ts",
  );
  assert.equal(hits.length, 1);
});

test("checks JSON string values and reports the key path", () => {
  const hits = checkJsonValues(
    rule("no-codename-in-ui"),
    { home: { title: "Welcome", hint: "Powered by CODENAME" }, list: ["ok"] },
    "locales/en.json",
  );
  assert.deepEqual(
    hits.map((h) => h.key),
    ["home.hint"],
  );
});

test("scans a repo end to end, skipping tests and node_modules", () => {
  const root = tempRepo({
    "src/bad.ts": 'export const f = () => supabase.from("users");',
    "src/ok.ts":
      'export const g = () => supabase.functions.invoke("get-users");',
    "src/bad.test.ts": 'supabase.from("users")',
    "src/node_modules/lib/index.ts": 'x.from("users")',
    "locales/en.json": JSON.stringify({ a: "Codename inside" }),
  });
  const { violations, errors } = checkRepo(rules, root);
  assert.deepEqual(errors, []);
  assert.deepEqual(violations.map((v) => `${v.rule} ${v.file}`).sort(), [
    "no-codename-in-ui locales/en.json",
    "no-direct-db src/bad.ts",
  ]);
});

test("reports invalid JSON as an error instead of crashing", () => {
  const root = tempRepo({
    "locales/en.json": "{ not json",
    "src/ok.ts": "export const a = 1;",
  });
  const { violations, errors } = checkRepo(rules, root);
  assert.equal(violations.length, 0);
  assert.deepEqual(
    errors.map((e) => e.file),
    ["locales/en.json"],
  );
  assert.match(errors[0].message, /invalid JSON/);
});

const run = (root) =>
  spawnSync(
    process.execPath,
    [path.join(__dirname, "check-rules.js"), EXAMPLE, root],
    { encoding: "utf8" },
  );

test("exits 0 on a clean repo", () => {
  const result = run(
    tempRepo({
      "src/ok.ts": "export const a = 1;",
      "locales/en.json": JSON.stringify({ title: "Welcome" }),
    }),
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no violations/);
});

test("exits 1 on a violation, naming the file, line and rule", () => {
  const result = run(tempRepo({ "src/bad.ts": "\nsupabase.from('users')" }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[no-direct-db\] src\/bad\.ts:2/);
});

test("exits 1 when a file cannot be parsed", () => {
  const result = run(tempRepo({ "locales/en.json": "{ broken" }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid JSON/);
});

test("fails when a rule finds no files to check", () => {
  const result = run(tempRepo({ "README.md": "nothing to scan here" }));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no files to check/);
});

test("only honours the ignore marker inside a comment", () => {
  const src = 'const s = "rules-check-ignore: x"; supabase.from("users");';
  assert.deepEqual(
    lines(checkSource(rule("no-direct-db"), src, "src/x.ts")),
    [1],
  );
});

test("an apostrophe in JSX text does not hide a comment later on the line", () => {
  const src = '<Text>Don\'t park</Text> {/* supabase.from("x") */}';
  assert.deepEqual(checkSource(rule("no-direct-db"), src, "src/x.tsx"), []);
});

test("accepts repeated or global flags in a rule", () => {
  const custom = compile({
    id: "t",
    message: "",
    dirs: [],
    extensions: [],
    pattern: "TODO",
    flags: "gig",
    allow: "^todo$",
  });
  assert.equal(custom.regex.flags, "gi");
  assert.equal(custom.allowRegex.flags, "i");
});
