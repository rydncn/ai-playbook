# Convention templates

Area rules for a project's `.claude/rules/` folder. Each one loads only when the agent works on files matching its `paths:`, so it costs nothing elsewhere. They are conventions rather than playbook rules because they depend on the stack: a mobile app with no server of its own needs the React Native one, not the other two.

| File                                   | Covers                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`api.md`](api.md)                     | Secure-by-default endpoints, RFC 9457 problem details for every error, specific domain errors mapped at the edge                                                                            |
| [`observability.md`](observability.md) | Structured logging with the language's standard logger, and correlation IDs carried across async boundaries                                                                                 |
| [`react-native.md`](react-native.md)   | A phone app the playbook's way: native modules behind adapters with contract-tested fakes, acceptance tests that drive the real app, and an accessibility gate that walks the rendered tree |

To use one, copy it into `.claude/rules/`, set `paths:` to where that code lives in the project, fill in the placeholders, and delete anything the project has decided differently. Each ends with how its conventions are checked; add those checks too, or the file is only advice.
