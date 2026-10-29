# Check interactive states

**Area:** accessibility · **Enforced by:** a gate that exercises each state

## Rule

Accessibility checks cover hover, focus and other interactive states, not only the page at rest. Any state that changes colour is checked for contrast in that state.

## Why

Automated checkers such as axe test the page as loaded and never enter hover or focus. An agent restyling a hover state can drop its contrast far below WCAG 1.4.11 while every gate stays green.

## How to enforce it

A gate walks every interactive element in each theme, triggers each state, and checks contrast and that a visible change happened. It must confirm it is comparing the same element before and after, and fail if it finds nothing to check.
