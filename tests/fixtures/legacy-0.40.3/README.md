# legacy-0.40.3 fixtures

These PDFs were written by the published `modern-pdf-lib@0.40.3` (npm tarball, integrity pinned in the generator), never by this tree. Never edit them by hand: `manifest.json` holds the sha256 of every file and `tests/oracle/legacy-0.40.3.test.ts` fails on any difference.
Regenerate with `pnpm run fixtures:legacy`; verify byte-identical regeneration with `pnpm run fixtures:legacy:check` (it installs 0.40.3 into a temp directory outside the repo).
The generator pins `Date`, `Date.now` and `crypto.getRandomValues` (fixed clock 2026-10-30T12:00:00Z, seeded LCG), so the encrypted fixtures use predictable salts and IVs: test fixtures only.
`signed.pdf` is signed with the throwaway RSA key in `scripts/fixtures/legacy-0.40.3/test-signer.json` and a self-signed certificate trusted nowhere. The signed update carries no `/AcroForm` (signature-cms-10).
`forms.pdf` comes from `buildFormFromJsonSchema`, the only 0.40.3 path that writes an `/AcroForm`; `getForm().create*` writes none (forms-35).
Passwords of the encrypted files are in `manifest.json` (`expect.encryption`).
