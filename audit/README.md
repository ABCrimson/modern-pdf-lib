# Audit ledger

`open-highs.json` lists the findings of the 2026 audit of modern-pdf-lib that are still open, with
the release planned to close each one, and the findings already closed. `open-highs.schema.json`
describes the file (JSON Schema 2020-12).

## What is in the file

- `open`: one entry per open finding: its stable `id`, the audit `area`, `severity` (`high`, or
  `medium` for a finding that a known-defect test marker uses), `status` (`confirmed`, `missed` or
  `unverified`), the `path` of the file it concerns, the `target` release that closes it, and a
  one-line `summary` in user terms.
- `closed`: findings fixed in an earlier release or in the release the file ships with
  (`fixedIn`), or refuted by two independent re-checks (`refuted: true`).
- `counts`: the number of open entries, the number closed in this release, and the open entries
  per target release.

Which findings are listed: the findings that are safe to publish. Some findings are held until
they have been reviewed, and a security finding that no published advisory covers yet is held
until its advisory is published or its fix ships, whichever comes first. See
[SECURITY.md](../SECURITY.md) for how to report a vulnerability.

## How the file is used

- A test that shows an open defect is a known-defect marker (`tests/helpers/known-defect.ts`):
  `knownDefect(defectKey('<id>', '<target>'), ...)`. Its id must be an entry of `open`, and its
  `until` must equal that entry's `target`.
- `node scripts/dev/surface-gate.ts --paths --markers` checks the file against its schema, checks
  that every `path` exists, and prints the markers in the test suite by id.

## How an entry closes

The commit that fixes a finding replaces its marker with a plain test and moves the entry from
`open` to `closed` with `fixedIn` set to the release it ships in. Ids are permanent: a closed id
is never reused.
