# Node pack

JavaScript and TypeScript, from the playbook's first trial (an Expo app) and its own tooling. The files are the top-level templates, because the playbook started on this stack:

- [`../../ci.yml`](../../ci.yml): CI, including the npm supply-chain steps (lockfile integrity, registry signatures, the version check for `min-release-age`).
- [`../../npmrc`](../../npmrc), [`../../audit/`](../../audit), [`../../lint-ratchet/`](../../lint-ratchet).
- The hooks need no `checks.json`: without one they run Prettier, ESLint and the `package.json` scripts `typecheck`, `lint` and `test:changed`.
- [`../../settings.json`](../../settings.json): its allow list is the npm one.
- [`../../rules/react-native.md`](../../rules/react-native.md) for React Native.
- For browser UI, [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (from the browser vendors and MDN) is worth a look, but not yet proven here. Its skill runs `npx -y modern-web-guidance@latest` before every front-end task, which downloads unpinned code each time: change `@latest` to an exact version and allow only that command ([rule 18](../../../rules/18-agent-configuration-is-code.md)).

Notes from the trials: the Node LTS ships an npm older than 11.10, which ignores `min-release-age`, so CI installs npm at an exact version; Jest's `toEqual` ignores `undefined` properties, so use `toStrictEqual` where absence is the point; Stryker's incremental mode keeps mutation testing cheap on changed files.
