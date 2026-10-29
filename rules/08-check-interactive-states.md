# Check interactive states

**Area:** accessibility · **Enforced by:** a gate that exercises each state

## Rule

Accessibility checks cover hover, focus and other interactive states, not only the page at rest. Any state that changes colour is checked for contrast in that state.

## Why

Automated checkers such as axe test the page as loaded and never enter hover or focus. An agent restyling a hover state can drop its contrast far below WCAG 1.4.11 while every gate stays green.

## How to enforce it

On the web, a gate walks every interactive element in each theme, triggers each state, and checks contrast and that a visible change happened. It must confirm it is comparing the same element before and after, and fail if it finds nothing to check.

On a phone there is no hover, and focus is the screen reader's cursor. The states to check are pressed, selected and disabled, in both themes. Each screen is also checked at font scale 1.0 and 2.0, for text that clips or overlaps, and its accessibility tree is dumped and checked: every control has a role and a label, and the reading order matches the visual order. An automated gate can walk the rendered tree in tests; what only a device shows, such as how VoiceOver or TalkBack actually reads the screen, goes in the device checks ([rule 16](16-acceptance-tests-are-isolated-and-real.md)).

Data is a state too. Components designed against demo data break on real data: long names, unbreakable emails, a count of one, an empty list, non-Latin text, large text sizes. Before a component counts as done, render it with realistic worst-case values taken from the project's own schema limits; the `break-ui` plugin in [setup.md](../docs/setup.md) does this.
