# Versioning Policy

This project uses **MAJOR.MINOR.PATCH** versioning. PATCH is a single digit; MINOR is not capped.

## Format

```
MAJOR . MINOR . PATCH
  0   .  40   .  2
```

## Rules

**Only PATCH is capped at 9.** There is no `0.40.10`: after `x.y.9` comes `x.(y+1).0`. MINOR is not capped.

| Current | Next |
|---|---|
| `0.40.8` | `0.40.9` |
| `0.40.9` | `0.41.0` |

## What Each Position Means

### PATCH (0.40.**2** → 0.40.**3**)

Bug fixes, documentation, tests, CI, internal moves and dependency updates. A patch removes no export. It adds an export, a parameter or a result field only when a fix needs one, such as the error class a refused call now throws.

A patch may change what a call does where the earlier behaviour was a security defect, silent data corruption, output that conforming readers reject, or an accepted option that silently had no effect: the call may throw, report `false` or `unknown`, return or write what the specification requires, or emit a one-time runtime warning. Such a release describes each change in its changelog entry.

*Examples: fix a typo, update a dependency, improve an error message, add a test, refuse an operation that left data unprotected.*

### MINOR (0.**40**.0 → 0.**41**.0)

New features and API additions. Before 1.0.0, every other breaking change and every export removal lands only in a minor `x.0`, listed under Breaking in its changelog entry.

*Examples: add a new drawing method, add form field support, add a new image format, change what a function returns (other than a fix as described under PATCH).*

### MAJOR (**0**.0.0 → **1**.0.0)

`1.0.0` freezes the public API. After it, a breaking change needs a new MAJOR.

## Current Version

**0.40.9** — See [CHANGELOG.md](./CHANGELOG.md) for the full release history.
