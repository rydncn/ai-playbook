# Prove that configuration takes effect

**Area:** frameworks and configuration · **Enforced by:** a test or run that shows the behaviour

## Rule

When an agent adds or changes framework configuration, check it against the documentation for the installed version and show that it changes behaviour.

## Why

Agents write plausible configuration for options that do not exist. Many frameworks ignore unknown configuration without a warning, so the build passes and the behaviour never happens.

## How to enforce it

Each configuration change comes with a test, or a recorded run, that fails without it. If the agent cites an option, the plan links to the documentation for the version in the lockfile.
