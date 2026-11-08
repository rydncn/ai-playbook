# Lifecycles are explicit

**Area:** data model and state · **Enforced by:** a transition-table test per lifecycle, a [rule check](../templates/rule-check) on the underlying fields once a definition exists, and review

## Rule

Anything that moves through stages has one status field with a fixed set of values: an order, a moderation item, a session, a subscription, a screen's start-up flow. In the database, an enum or a `CHECK` constraint; in code, a union of named states, each carrying only the data that state has. Changes go through one function per lifecycle, which checks the current state and refuses a move the lifecycle doesn't allow.

A condition derived from that state, such as "active", "visible" or "due", is defined once: a view, a database function or one domain function that every reader uses. A move that happens with time, such as expiry, is made by a scheduled job or computed inside that one definition, never left for each query to work out. Every lifecycle has a table of states and actions, and a test that walks it.

## Why

When a lifecycle lives in several booleans and timestamps, every reader has to rebuild it, and the copies drift. In one production codebase reviewed for this playbook, an expiry time was checked by the public map and not by an organisation's dashboard, so the two disagreed about which items were active, and nothing failed. Separate fields also make impossible combinations representable (loaded and still loading; ended but awaiting a reminder), and the code meets them in an order nobody designed for. Agents make this worse: adding one flag or one timestamp looks like a small, local change, so they reach for it every time, and no single change shows the state machine it is building.

## How to enforce it

- Each design names its lifecycles, with their states and moves, before the acceptance criteria ([design template](../templates/DESIGN.md)). Each refused move becomes a criterion.
- A transition-table test per lifecycle: for every state and every action, the resulting state, or the refusal. Generated from the table, so a new state or action without a decided outcome fails the test.
- Once a derived condition has its definition, a rule check fails on code or SQL that reads the underlying fields directly outside it.
- Review treats a new boolean or timestamp that changes what a record means as a new state: which lifecycle does it belong to, and is the table updated?
