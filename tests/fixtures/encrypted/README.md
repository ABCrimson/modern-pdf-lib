# encrypted fixtures

Read by `tests/oracle/aes.test.ts` (G-AES, read direction). Never edit them by hand: `manifest.json` holds the SHA-256 of every file, and the test fails on any difference.

- `source.pdf` is written byte for byte by `scripts/oracle/encrypted-fixtures.ts` from literals in that script: one page showing `Oracle text` in Helvetica, the Info Title `Oracle fixture` and an XMP metadata stream with the same title.
- The other five files are `source.pdf` encrypted by qpdf 12.4.2 with user password `user` and owner password `owner`: `rc4-40-r2.pdf` (R2, 40-bit RC4), `rc4-128-r3.pdf` (R3, 128-bit RC4), `aes-128-r4.pdf` (R4, AESv2), `aes-128-r4-nometa.pdf` (R4, AESv2, `/EncryptMetadata false`, so the XMP stream stays in cleartext) and `aes-256-r6.pdf` (R6, AESv3). The exact qpdf command line of each file is in `manifest.json` (`made`), with qpdf's `--show-encryption` output (`encryption`).

Regenerate with `pnpm run fixtures:encrypted`; verify with `pnpm run fixtures:encrypted:check`. Both need qpdf 12.4.2 (`QPDF=<path>` or `qpdf` on PATH) and refuse any other version. qpdf runs with its test options `--static-id` and `--static-aes-iv`, so the R2, R3 and R4 files are byte-identical on every run and the check compares their SHA-256. qpdf draws the R6 salts at random, so for `aes-256-r6.pdf` the check compares `qpdf --decrypt --qdf` of the committed file with the same command on a fresh encryption, and regeneration keeps the committed file when the two agree.

These are test fixtures only: the passwords are public and the RC4 files use encryption that qpdf calls weak (`--allow-weak-crypto`).
