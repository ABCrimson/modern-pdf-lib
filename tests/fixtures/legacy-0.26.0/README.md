# legacy-0.26.0 fixture

`encrypted-r6.pdf` was written by the published `modern-pdf-lib@0.26.0` (npm tarball, integrity pinned in the generator), never by this tree. Never edit it by hand: `manifest.json` holds its sha256 and `tests/oracle/legacy-0.26.0.test.ts` fails on any difference.
It is an AES-256 (V5, R6) file whose password hash follows the derivation modern-pdf-lib 0.26.0 to 0.40.8 wrote, which other PDF software does not accept; the current reader opens it with one `MPL_LEGACY_R6_KEY` warning per realm.
Regenerate with `node scripts/legacy-0.26.0/generate.ts`; verify byte-identical regeneration with `node scripts/legacy-0.26.0/generate.ts --check` (it installs 0.26.0 and its dependency fflate 0.8.2 into a temp directory outside the repo and loads its CommonJS build). The test suite does not run the generator.
The generator pins `Date`, `Date.now` and `crypto.getRandomValues` (fixed clock 2026-10-30T12:00:00Z, seeded LCG), so the file uses predictable salts and IVs: test fixture only.
Its passwords are in `manifest.json` (`expect.encryption`).
