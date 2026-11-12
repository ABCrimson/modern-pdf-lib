# Real-world PDF corpus

PDF files written by other producers (Acrobat, Adobe Designer, InDesign, LibreOffice, pyHanko,
qpdf, the veraPDF test builder and the pdf.js maintainers' generators), committed unmodified so the load, text, save and reload paths of this
library run against files it did not write. Nothing under `tests/` ships to npm.

`manifest.json` holds one entry per file, sorted by `id`: the file name (`<id>.pdf`), its SHA-256
and byte count, the pinned source URL with its retrieval date, the licence and attribution,
`contactData` (`"none"`, or `"institutional"` with a `contactDataReason`; see Rules), the PDF
header version and producer that pdf.js reports, structural features, the category, the
password to open it (`null` for none) and the oracle values measured at admission with qpdf 12.4.2
and pdfjs-dist 6.5.438 (`qpdfCheck`: qpdf's `--check` exit code on the input, 0 or 3; `pages`;
`pdfjsChars`; `textSample`: text that pdf.js extracts from page 1, chosen by hand).

`category` is `real`, or `damaged` when qpdf's `--check` warnings on the input are about its
cross-reference data, a stream or an object qpdf repairs, and the file is kept as a recovery case.
Warnings only about linearization hint tables leave a file `real`. The category follows qpdf's
verdict on the input, never whether this library needed to recover.

## Rules

- Licences: Apache-2.0, MIT, CC-BY-4.0, CC0-1.0 and US-PD (works of the U.S. federal government,
  17 U.S.C. 105). Each licence used has its text in `LICENSES/`.
- Size: each file at most 256 KiB; the whole directory at most 3 MiB.
- Provenance: a commit-pinned or dated URL and the SHA-256 of the bytes it served. Entries with
  `"fetchStable": false` come from URLs whose bytes the publisher may replace (the IRS replaces
  files under `irs-pdf/` in place; `irs-p1-chinese` is one); the committed bytes and their
  SHA-256 are the reference.
- Admission: a candidate passes through load, strict load, page count, text extraction, save and
  reload in a child process under a time and memory budget before it is committed.
- Contact data: no file may hold an e-mail address, IP address or telephone number of a named
  natural person, wherever it appears. The scan looks for e-mail, IPv4, IPv6
  and telephone-number patterns in the pdf.js text and annotations (contents, author, field
  names and values, alternative text, link URLs) of every page, the form field values, the
  embedded file names and descriptions, the Info dictionary, the XMP metadata, and every string
  object outside stream data, which includes the /Name, /ContactInfo, /Location and /Reason of
  signature dictionaries and the certificates in their /Contents. It reads those strings from
  qpdf's decrypted, uncompressed QDF form when `QPDF` is set, and from the file's own bytes
  otherwise (object streams included; an encrypted file's strings are then skipped). It prints
  each hit with its place. A file with a hit is admitted only as
  `"contactData": "institutional"`, with a `contactDataReason` saying what the hits are: an
  institution's own addresses or telephone lines, a placeholder identity (a certificate subject
  at example.com or example.org), or strings the patterns match that are not contact data.
  `node scripts/dev/corpus.ts --contacts` runs the same scan over every committed file, and
  `--check` runs it too. Every entry whose object strings the scan skipped counts as
  unconfirmed, whether it records `"none"` or `"institutional"`; only a run with `QPDF` set
  confirms those entries.
  - Institutional: `irs-fw4`, `irs-fw9` and `irs-p1-chinese` (IRS and FTC role mailboxes and the
    public telephone lines of the SSA, the IRS, the Taxpayer Advocate Service, TIGTA, the FTC
    and the federal relay service).
  - Placeholder identities: `pyhanko-signed-twice` (alice@example.com) and `qpdf-signed`
    (jdoe@example.org), both in the subject of a test signing certificate.
  - Not contact data: `qpdf-hybrid-xref`, `qpdf-linearized`, `qpdf-r3-rc4`, `qpdf-r4-aes`,
    `qpdf-r4-rc4`, `qpdf-r6-acrobat-xi` and `qpdf-r6-attachments`, whose made-up test outline
    numbers sections 1.1.1.1, 1.1.1.2 and 1.1.2.1, which the IPv4 pattern matches. Five of them are
    encrypted, so without qpdf the scan cannot read those titles; it then counts those entries,
    like every other encrypted entry, as unconfirmed instead of failing.
- Files are added or removed, never replaced: a changed file gets a new id.

`tests/oracle/corpus.test.ts` runs eight checks on every file: SHA-256; load; no recovery scan
and a strict load (category `real`) or a load that recovers (category `damaged`); page count
against `oracle.pages`; text extraction from every page, with page 1 containing `textSample`;
`save({ compress: false })` and reload; `qpdf --check` of that saved file; and `qpdf --check` of
the default `save()` (compress on). Both qpdf checks expect exit 0 on the saved file; exit 3 is
accepted only for the input, as `oracle.qpdfCheck` records it, never for this library's output,
so a saved file that draws qpdf warnings carries a marker. A check that fails because of an open
defect is a known-defect marker keyed to its ledger id (or a provisional `corpus-Pnn` id) in the
test file's `KNOWN` map; the release that fixes the id removes or re-keys it.

`node scripts/dev/corpus.ts --check` is the G-CORPUS gate: it validates the manifest against this
directory (presence, SHA-256, sizes, licences, this README naming every id, no unlisted PDF),
re-runs the contact scan and fails when an entry's `contactData` disagrees with it (`"none"`
with a hit, or `"institutional"` without one when its strings were read), then runs
`tests/oracle/corpus.test.ts` and fails on a failed test, a marker that did not fail
for its stated reason, a marker id that is not an open id of `audit/open-highs.json` or a
provisional id of the test file, or a recovery scan on a `real` file without a marker. With
`--summary <path>` it writes the pass rate published per release (files, files that load, files
that pass every check, and per id the markers that ran; a qpdf check skipped because qpdf is
absent counts nothing). `node scripts/dev/corpus.ts --fetch` (network) downloads
every source URL again and compares it with the manifest's SHA-256.

## Adding a file

```sh
QPDF=/path/to/qpdf node scripts/dev/corpus.ts --add <pinned url> --id <id> \
  --licence <Apache-2.0|MIT|CC-BY-4.0|CC0-1.0|US-PD> --project <name> --attribution "<text>" \
  [--password <user password>] [--category damaged] [--features <a,b>] \
  [--text-sample "<page-1 text>"] [--fetch-unstable] \
  [--contact-data institutional --contact-reason "<what the hits are>"]
```

Then add the file's line to the list below and, for a new licence, its text to `LICENSES/`.

## Licence evidence

- qpdf (`qpdf-*`): the repository's `LICENSE.txt` (Apache License 2.0) and `NOTICE.md`
  ("qpdf is copyright (c) 2005-2021 Jay Berkenbilt, 2022-2026 Jay Berkenbilt and Manfred Holger")
  at commit 4eba95899886e851cc41d76886483b347612f2a8 of github.com/qpdf/qpdf. The files are
  test inputs from `qpdf/qtest/qpdf/`. Neither file says where test inputs came from, so each
  file's adding commit and the last commit that changed it were read on 2026-11-12 (GitHub
  commits API, `path=qpdf/qtest/qpdf/<name>`, `sha=4eba958`), and only files that those commits
  and the file's own content show were made for qpdf's tests are used. Where no later commit is
  named, the adding commit is the last one that changed the file, so the committed bytes are
  from it:
  - `bad-xref.pdf`: 85107f39f2 (Manfred Holger, 2024-03-06, "Add bad xref table test").
  - `damaged-stream.pdf`: 9ac249e7e7 (Jay Berkenbilt, 2009-03-09, "add damaged stream test case").
  - `form-filled-by-acrobat.pdf`: 3b8ce4f12a (Jay Berkenbilt, 2019-01-01, "Annotation flattening
    including form fields"); `form-empty-from-odt.pdf`: 0b05111db8 (Jay Berkenbilt, 2018-06-19,
    "Implement helper class for interactive forms"). Both are the same made-up form ("Where's my
    form?", "Potato").
  - `hybrid-xref.pdf` and `enc-R3,V2,U=view,O=master.pdf`: 9a0b88bf77 (Jay Berkenbilt,
    2008-04-29), the first commit of the imported history; their pages hold only qpdf's own test
    text ("Potato 0" to "Potato 29"). `hybrid-xref.pdf` was last changed in 531f6877a8 (Jay
    Berkenbilt, 2025-01-05, "Tweak test files to work around fixed ghostscript bug"), whose
    bytes are the committed ones.
  - `incremental-3.pdf`: 07f6c635a9 (Jay Berkenbilt, 2024-01-07, "Bug fix: treat old generations
    of reused objects as null").
  - `page-labels-num-tree-damaged.pdf`: 2b88c11b9e (Manfred Holger, 2025-08-27, "Add test for
    damaged page label numbers").
  - `c-linearized.pdf`: 65bf77fa35 (Jay Berkenbilt, 2009-09-27, "more tests of C API"); last
    changed in 4ee393d1fa (Jay Berkenbilt, 2023-12-20, "Remove compression from linearization
    tests where possible"), whose bytes are the committed ones.
  - `compress-objstm-xref.pdf`: 2712869cf9 (Jay Berkenbilt, 2019-01-29, "Fix logic for when to
    compress object and xref streams (fixes #271)").
  - `V4.pdf` and `V4-aes.pdf`: 70ae58c035 (Jay Berkenbilt, 2009-10-19, "better testing of V4");
    both last changed in eae8370cd9 (Jay Berkenbilt, 2013-06-15, "Add optional /Length key in
    crypt filter dictionary"), whose bytes are the committed ones.
  - `enc-XI-R6,V5,U=view,O=master.pdf` and `enc-XI-R6,V5,U=view,attachments,cleartext-metadata.pdf`:
    e57c25814e (Jay Berkenbilt, 2012-12-30, "Support for encryption with /V=5 and /R=5 and
    /R=6").
  - `digitally-signed.pdf`: 5e0ba12687 (Masamichi Hosoda, 2019-09-26, "Fix /Contents value
    representation in a signature dictionary"), a contribution to qpdf; its page holds "Potato".

  What the repository-level licence proves for these test inputs: the qpdf project distributes
  them in its repository under Apache-2.0, and the commits above show who put each file's
  committed bytes there. It does not prove that the committer held the rights to every part of
  a file (a test input can carry content, such as an embedded font or text, that came from
  elsewhere), so a file is used only when its commits and its own content show it was made for
  qpdf's tests; files that came from bug reports or of unknown origin are not used.

- pdf.js (`pdfjs-*`): the repository's `LICENSE` (Apache License 2.0) at commit
  421ff37ca8672bb53f7572461012afbd0f47b7e8 of github.com/mozilla/pdf.js. Only files generated
  by the project are used: the `perf_*` files were added by a pdf.js maintainer in commit
  0b093fb1127 ("Add PDFs for the Talos rendering corpus", 2026-10-28) and `jpx_subsampling.pdf`
  in commit a72eb1599fb (2026-10-13), both read on 2026-11-11.
- pyHanko (`pyhanko-*`): the repository's `LICENSE` (MIT, "Copyright (c) 2020-2026 Matthias
  Valvekens") at commit 0b27455d49ecde3d2853f598558f76d1af38cbf1 of
  github.com/MatthiasValvekens/pyHanko; `LICENSES/MIT.txt` is that file.
- veraPDF corpus (`vera-*`): the repository's `README.md` at commit
  bb75f4f0073d9350dfd058c0162a367e6fadf25e of github.com/veraPDF/veraPDF-corpus states "This
  work is licensed under a Creative Commons Attribution 4.0 International (CC BY 4.0)" license.
- IRS (`irs-*`): works of the U.S. federal government, public domain in the U.S. under
  17 U.S.C. 105; see `LICENSES/US-PD.md`. `irs-fw9` and `irs-fw4` come from the IRS archive of
  prior revisions (`irs-prior/`), whose files carry their revision year.

Font programs embedded in these files keep the terms their vendors set; the files are
redistributed unmodified, as their publishers distribute them.

## Coverage gaps

The corpus has no file of these kinds. The files that covered the first three left it because
they held a named person's contact data, and no file with such data fills a gap:

- pdfTeX output (an arXiv paper, removed for its author's e-mail address).
- Ghostscript output (an arXiv paper, removed for its author's e-mail address).
- Word output (an IRS notice, removed for the telephone numbers of the staff it names as
  contacts).
- A file signed by a real-world signing application: the two signed files, `pyhanko-signed-twice`
  and `qpdf-signed`, are test-suite files whose certificates carry placeholder identities.

## Files

- `irs-fw4` (US-PD, retrieved 2026-11-11): U.S. Internal Revenue Service, Form W-4 (2026); a work of the U.S. federal government (17 U.S.C. 105), unmodified. Source: [IRS](https://www.irs.gov/pub/irs-prior/fw4--2026.pdf).
- `irs-fw9` (US-PD, retrieved 2026-11-11): U.S. Internal Revenue Service, Form W-9 (Rev. March 2024); a work of the U.S. federal government (17 U.S.C. 105), unmodified. Source: [IRS](https://www.irs.gov/pub/irs-prior/fw9--2024.pdf).
- `irs-p1-chinese` (US-PD, retrieved 2026-11-11): U.S. Internal Revenue Service, Publication 1 (Simplified Chinese), Your Rights as a Taxpayer; a work of the U.S. federal government (17 U.S.C. 105), unmodified. Source: [IRS](https://www.irs.gov/pub/irs-pdf/p1zhs.pdf).
- `pdfjs-ccitt` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/perf_codecs_ccitt.pdf).
- `pdfjs-cid-truetype` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/perf_text_cid_truetype.pdf).
- `pdfjs-cjk-nonembedded` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/perf_text_cjk_nonembedded.pdf).
- `pdfjs-cmap-mixed` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/perf_text_cmap_mixed.pdf).
- `pdfjs-jbig2` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/perf_codecs_jbig2.pdf).
- `pdfjs-jpx-subsampling` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/jpx_subsampling.pdf).
- `pdfjs-structure-forms` (Apache-2.0, retrieved 2026-11-11): pdf.js test suite (github.com/mozilla/pdf.js), Apache-2.0, unmodified. Source: [pdf.js](https://raw.githubusercontent.com/mozilla/pdf.js/421ff37ca8672bb53f7572461012afbd0f47b7e8/test/pdfs/perf_structure_forms.pdf).
- `pyhanko-aes256` (MIT, retrieved 2026-11-11): pyHanko test suite (github.com/MatthiasValvekens/pyHanko), Copyright (c) 2020-2026 Matthias Valvekens, MIT, unmodified. Source: [pyHanko](https://raw.githubusercontent.com/MatthiasValvekens/pyHanko/0b27455d49ecde3d2853f598558f76d1af38cbf1/internal/common-test-utils/src/pyhanko_testing_commons/test_data/data/pdf/minimal-aes256.pdf).
- `pyhanko-hybrid-msword` (MIT, retrieved 2026-11-11): pyHanko test suite (github.com/MatthiasValvekens/pyHanko), Copyright (c) 2020-2026 Matthias Valvekens, MIT, unmodified. Source: [pyHanko](https://raw.githubusercontent.com/MatthiasValvekens/pyHanko/0b27455d49ecde3d2853f598558f76d1af38cbf1/internal/common-test-utils/src/pyhanko_testing_commons/test_data/data/pdf/minimal-hybrid-xref-mswordstyle.pdf).
- `pyhanko-rc4` (MIT, retrieved 2026-11-11): pyHanko test suite (github.com/MatthiasValvekens/pyHanko), Copyright (c) 2020-2026 Matthias Valvekens, MIT, unmodified. Source: [pyHanko](https://raw.githubusercontent.com/MatthiasValvekens/pyHanko/0b27455d49ecde3d2853f598558f76d1af38cbf1/internal/common-test-utils/src/pyhanko_testing_commons/test_data/data/pdf/minimal-rc4.pdf).
- `pyhanko-signed-twice` (MIT, retrieved 2026-11-11): pyHanko test suite (github.com/MatthiasValvekens/pyHanko), Copyright (c) 2020-2026 Matthias Valvekens, MIT, unmodified. Source: [pyHanko](https://raw.githubusercontent.com/MatthiasValvekens/pyHanko/0b27455d49ecde3d2853f598558f76d1af38cbf1/internal/common-test-utils/src/pyhanko_testing_commons/test_data/data/pdf/minimal-signed-twice-no-sig-type.pdf).
- `pyhanko-ua-and-a` (MIT, retrieved 2026-11-11): pyHanko test suite (github.com/MatthiasValvekens/pyHanko), Copyright (c) 2020-2026 Matthias Valvekens, MIT, unmodified. Source: [pyHanko](https://raw.githubusercontent.com/MatthiasValvekens/pyHanko/0b27455d49ecde3d2853f598558f76d1af38cbf1/internal/common-test-utils/src/pyhanko_testing_commons/test_data/data/pdf/minimal-pdf-ua-and-a.pdf).
- `qpdf-bad-xref` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/bad-xref.pdf).
- `qpdf-damaged-stream` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/damaged-stream.pdf).
- `qpdf-form-acrobat` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/form-filled-by-acrobat.pdf).
- `qpdf-form-odt` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/form-empty-from-odt.pdf).
- `qpdf-hybrid-xref` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/hybrid-xref.pdf).
- `qpdf-incremental` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/incremental-3.pdf).
- `qpdf-labels-damaged` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/page-labels-num-tree-damaged.pdf).
- `qpdf-linearized` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/c-linearized.pdf).
- `qpdf-objstm-xref` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/compress-objstm-xref.pdf).
- `qpdf-r3-rc4` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/enc-R3,V2,U=view,O=master.pdf).
- `qpdf-r4-aes` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/V4-aes.pdf).
- `qpdf-r4-rc4` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/V4.pdf).
- `qpdf-r6-acrobat-xi` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/enc-XI-R6,V5,U=view,O=master.pdf).
- `qpdf-r6-attachments` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/enc-XI-R6,V5,U=view,attachments,cleartext-metadata.pdf).
- `qpdf-signed` (Apache-2.0, retrieved 2026-11-11): qpdf test suite (github.com/qpdf/qpdf), Copyright Jay Berkenbilt and Manfred Holger, Apache-2.0, unmodified. Source: [qpdf](https://raw.githubusercontent.com/qpdf/qpdf/4eba95899886e851cc41d76886483b347612f2a8/qpdf/qtest/qpdf/digitally-signed.pdf).
- `vera-pdfa2b-annot` (CC-BY-4.0, retrieved 2026-11-11): veraPDF corpus (github.com/veraPDF/veraPDF-corpus), CC BY 4.0, unmodified. Source: [veraPDF corpus](https://raw.githubusercontent.com/veraPDF/veraPDF-corpus/bb75f4f0073d9350dfd058c0162a367e6fadf25e/PDF_A-2b/6.3%20Annotations/6.3.3%20Annotation%20appearances/veraPDF%20test%20suite%206-3-3-t01-pass-c.pdf).
- `vera-pdfa4-trailer` (CC-BY-4.0, retrieved 2026-11-11): veraPDF corpus (github.com/veraPDF/veraPDF-corpus), CC BY 4.0, unmodified. Source: [veraPDF corpus](https://raw.githubusercontent.com/veraPDF/veraPDF-corpus/bb75f4f0073d9350dfd058c0162a367e6fadf25e/PDF_A-4/6.1%20File%20structure/6.1.3%20File%20trailer/veraPDF%20test%20suite%206-1-3-t03-pass-a.pdf).
- `vera-ua1-tagged` (CC-BY-4.0, retrieved 2026-11-11): veraPDF corpus (github.com/veraPDF/veraPDF-corpus), CC BY 4.0, unmodified. Source: [veraPDF corpus](https://raw.githubusercontent.com/veraPDF/veraPDF-corpus/bb75f4f0073d9350dfd058c0162a367e6fadf25e/PDF_UA-1/7.21%20Fonts/7.21.7%20Unicode%20character%20maps/7.21.7-t01-pass-c.pdf).
