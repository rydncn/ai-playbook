# Releases check their own environment

**Area:** releases · **Enforced by:** pre-publish script

## Rule

A release script checks that the target environment holds every value the build needs, and agrees with the build configuration, before publishing anything. If anything is missing it refuses.

## Why

Hosted build and update tools often ignore local environment files, so a release can go out with settings missing. Nothing errors: the app quietly behaves differently, or its error reports and analytics are mislabelled.

## How to enforce it

Run a guard before every release command. It lists the hosted environment's variables, compares them with what the build expects, and stops the release on any gap. Give the guard its own tests for the cases it must refuse.
