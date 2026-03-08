# Versioning Policy

This project uses **MAJOR.MINOR.PATCH** versioning with strict single-digit limits.

## Format

```
MAJOR . MINOR . PATCH
  0   .  11   .  5
```

## Rules

**Each digit position maxes out at 9.** There is no `0.11.10` — instead it rolls over:

| Current | Next |
|---|---|
| `0.11.8` | `0.11.9` |
| `0.11.9` | `0.12.0` |
| `0.99.9` | `1.0.0` |

## What Each Position Means

### PATCH (0.11.**5** → 0.11.**6**)

Bug fixes, documentation updates, small improvements. Anything that doesn't add significant new functionality.

*Examples: fix a typo, update a dependency, improve error message, add a test.*

### MINOR (0.**11**.0 → 0.**12**.0)

Something notable happened — a meaningful new feature, a non-trivial API addition, a significant performance improvement.

*Examples: add a new drawing method, add form field support, add a new image format.*

### MAJOR (**0**.0.0 → **1**.0.0)

Revolutionary changes that break existing consumer code. Once MAJOR increments, it signals that the library has undergone a fundamental shift.

*Examples: rename core functions, change the output format, remove deprecated APIs, rewrite the architecture.*

## Current Version

**0.25.0** — See [CHANGELOG.md](./CHANGELOG.md) for the full release history.
