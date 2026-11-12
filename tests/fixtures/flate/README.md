# flate fixtures

Two small PDFs whose cross-reference streams, object streams and content streams hold zlib data (RFC 1950), as the PDF format requires for `/FlateDecode` and as other producers write it. They were written by qpdf 12.4.2 (`qpdf --version`: `qpdf version 12.4.2`). `tests/unit/parser/flateRead.test.ts` loads them.

Input: `../legacy-0.40.3/raw-deflate-objstm.pdf` (written by modern-pdf-lib 0.40.3 with raw DEFLATE) rewritten as an uncompressed PDF with a classic cross-reference table: every stream inflated with node:zlib `inflateRawSync`, `/Filter` removed, objects 1 and 3 taken out of the object stream (object 8) as plain objects, the object stream and the cross-reference stream (object 9) dropped, objects 1-7 otherwise unchanged. `qpdf --check` of that input reports no errors. The two outputs therefore hold the same two pages, text and Info as the legacy file.

| File                         | Command                                                                                       | sha256                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `qpdf-objstm.pdf`            | `qpdf --static-id --object-streams=generate plain.pdf qpdf-objstm.pdf`                        | `c6aeb37bd30f33961eaa84bf4ed1abceaed03374daf018f45a21fe316d03ba70` |
| `qpdf-linearized-objstm.pdf` | `qpdf --static-id --linearize --object-streams=generate plain.pdf qpdf-linearized-objstm.pdf` | `49b7153faea4ba29da113cbaea7882b29ee51caa67d5dba22488934a2e17693c` |

Both outputs pass `qpdf --check`. Each stream starts with the zlib header `78 9c`; the cross-reference streams use `/DecodeParms << /Columns 4 /Predictor 12 >>` and `/W [ 1 2 1 ]`. The linearized file has two cross-reference streams joined by `/Prev`.

Never edit these files by hand.
