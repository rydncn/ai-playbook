# Check interactive states

**Area:** accessibility · **Enforced by:** a gate that exercises each state

## Rule

Accessibility checks cover hover, focus and other interactive states, not only the page at rest. Any state that changes colour is checked for contrast in that state.

## Why

Automated checkers such as axe test the page as loaded and never enter hover or focus. An agent restyling a hover state can drop its contrast far below WCAG 1.4.11 while every gate stays green.

## How to enforce it

A gate walks every interactive element in each theme, triggers each state, and checks contrast and that a visible change happened. It must confirm it is comparing the same element before and after, and fail if it finds nothing to check.

Data is a state too. Components designed against demo data break on real data: long names, unbreakable emails, a count of one, an empty list, non-Latin text, large text sizes. Before a component counts as done, render it with realistic worst-case values taken from the project's own schema limits; the `break-ui` plugin in [setup.md](../docs/setup.md) does this.
