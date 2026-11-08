---
# Set these to where the app's code and tests live.
paths:
  - "src/**"
  - "test/**"
  - "app/**"
---

# React Native conventions

How the playbook's testing rules apply to a phone app, which has no server and no browser. These come from the first trial, where they were the clearest gains over the same app built without the playbook: they are what let a test drive the whole app.

## The phone is behind adapters

- `src/platform/types.ts` defines one small interface per native capability the app uses: storage, files, notifications, pickers, printing, sharing, the clock and so on.
- `src/platform/<name>.ts` implements each over the Expo or React Native module. Nothing else imports a native module.
- `src/platform/fakes/` implements each in memory, honouring the behaviour the app relies on: a fake file system refuses to write into a folder that doesn't exist, as the phone does. Each fake has a test of that contract. A fake that only records calls is a mock, and rule 16 doesn't count it.
- `App` takes a `services` prop. The entry point passes the real set; tests pass fakes. Screens reach services through a `useServices()` hook.
- Pure logic lives in `src/domain/` and imports nothing from React or the platform.

**Checked by** a rule check failing on any `expo-*` or `@react-native-*` import outside `src/platform/`, and any React or platform import in `src/domain/` ([rule-check](../rule-check)). Plant one of each when adding it.

## Acceptance tests drive the real app

- One test per numbered acceptance criterion, in `test/acceptance/`, named for it. Each renders the real `App` with React Native Testing Library and a fresh set of fakes: an empty phone. It creates its own data, acts through the screens as a person would, and asserts on what they'd see or what was stored.
- Never `jest.mock` the app's own modules. Fakes sit only at the platform boundary.
- Run in random order (`--randomize`) and in parallel. When a run fails and a re-run passes, that's an order or time dependence: reproduce it with the failed run's seed, `npx jest --randomize --seed=<seed>`, and fix it. Don't re-run until green.
- This is tier 1 of [rule 16](../../rules/16-acceptance-tests-are-isolated-and-real.md). Tier 2 is Maestro on an emulator for the main journeys before release. Tier 3 is `docs/device-checks.md`: dated run-throughs of what only a phone shows (pickers, printing, notifications firing, rotation, TalkBack and VoiceOver), saying plainly what hasn't been run. Record the tiers in an ADR.

## The accessibility gate walks the rendered tree

There is no axe for React Native, and `eslint-plugin-react-native-a11y` doesn't support ESLint 9. Instead, two tests in CI:

- **Contrast:** every text and edge pair in every theme's palette, at 4.5:1 for text and 3:1 for edges.
- **The tree walk** (`test/a11y/gate.test.tsx`): render every screen in each theme at font scale 1.0 and 2.0, with a normal fixture and a worst-case one (long make and model, an unbreakable email, Arabic and Japanese text, a count of one, empty lists). Walk the rendered tree and assert a role and a name on every pressable, one element per toggle, labelled radio groups, units in field labels, and 48-point targets from the resolved style. Fail if it visited fewer screens or controls than a committed minimum, and raise the minimum in each slice that adds a screen; otherwise the gate silently covers less ([rule 9](../../rules/09-checks-must-prove-they-ran.md)).

The gate checks what the screen reader is given, not how it sounds; that's a device check. `break-ui` assumes a browser: on React Native, feed its worst case through the gate's fixture, and record layout findings as device checks.

## Tests

- Mutation testing (Stryker's Jest runner) works under `jest-expo` on `src/domain/`. Run it on changed files in CI on ready pull requests.
- Use `toStrictEqual`, or check `'key' in obj`, when the point is that something is absent: `toEqual` ignores `undefined` properties and array items.
- Don't `jest.spyOn(...).mockRestore()` a method of AsyncStorage's Jest mock. Its methods are already `jest.fn`s, so `mockRestore` empties them for every later test in the file. Wrap the mock in a plain object and swap that object's method instead.

## Dependencies

- Add native packages at the version the Expo SDK expects: `npx expo install <package>`, which needs `api.expo.dev`. Without network access to it, read the version from `node_modules/expo/bundledNativeModules.json` and run `npm install <package>@<version>`.
- Before using an Expo or React Native API, read the documentation for the SDK version in `package.json`, not memory.
- Never `--legacy-peer-deps`. Before pushing a dependency change: `rm -rf node_modules && npm ci`, then the checks.
