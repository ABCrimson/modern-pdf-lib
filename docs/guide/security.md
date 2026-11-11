# Security & Redaction Auditing

Beyond creating and signing PDFs, modern-pdf-lib ships a hardening layer for
**auditing** untrusted documents: a static threat scanner, a content sanitizer,
a redaction-leak verifier, and an encryption/permission inspector. These tools
inspect or clean an existing PDF. Applying redactions is not available in this
release: the apply functions throw `RedactionIncompleteError` (code
`redaction-incomplete`, reason `redaction-unavailable`) and change nothing (see
[Redaction](#see-also)). Earlier releases could report a redaction as applied
while text stayed in the file.
[See the security advisories published with 0.40.5](https://github.com/ABCrimson/modern-pdf-lib/security/advisories).

| Tool | Answers | Mutates the PDF? |
|---|---|---|
| [`scanPdfThreats`](#threat-scanning) | What dangerous active content is in here? | No — read-only report |
| [`sanitizePdf`](#sanitizing-active-hidden-content) | Give me a copy with that content removed. | Returns a **new** document |
| [`verifyRedactions`](#verifying-redactions) | Is text still extractable in these regions? (It reports what it finds; it cannot prove a region empty.) | No — read-only report |
| [`inspectEncryption`](#inspecting-encryption-permissions) | How is this protected, and what does it permit? | No — never decrypts content |

> [!TIP]
> A useful pipeline for untrusted uploads: `scanPdfThreats` to decide whether to
> accept the file at all, then `sanitizePdf` on everything you do accept.

## Threat scanning

`scanPdfThreats` walks a PDF's **parsed object graph** (not its raw bytes) and
reports the dangerous active-content constructs defined in ISO 32000 §12.6:
auto-run actions (`/OpenAction`, `/AA`), JavaScript (`/S /JavaScript` and the
`/Names → /JavaScript` tree), `/Launch`, remote/exfiltration actions
(`/URI`, `/SubmitForm`, `/ImportData`, `/GoToR`), embedded media, executable
attachments, and `/XFA`.

```ts
import { scanPdfThreats } from 'modern-pdf-lib';

const report = await scanPdfThreats(pdfBytes);
// report.riskLevel: 'none' | 'low' | 'medium' | 'high'  (the max finding severity)
for (const f of report.findings) {
  console.log(`[${f.severity}] ${f.category} — ${f.detail}` + (f.objectRef ? ` (${f.objectRef})` : ''));
}
```

```ts
interface ThreatReport {
  findings: ThreatFinding[];
  riskLevel: ThreatSeverity | 'none';
}
interface ThreatFinding {
  category: string;
  severity: ThreatSeverity;   // 'low' | 'medium' | 'high'
  detail: string;
  objectRef?: string;         // "N G R" of the offending object, when known
}
```

Because detection is structural, a content stream that merely *draws* the word
"JavaScript" produces **no** finding — only a real `/S /JavaScript` action or a
JavaScript name-tree entry does. This avoids the false positives a naive
byte-grep would raise.

## Sanitizing active & hidden content

`sanitizePdf` returns a **cleaned copy** with active and hidden content
physically removed (not merely de-referenced — orphaned objects are pruned from
the output bytes), plus a report of what was actually present and removed.

```ts
import { sanitizePdf } from 'modern-pdf-lib';

const { pdf, report } = await sanitizePdf(pdfBytes);
console.log('Removed:', report.removed); // e.g. ['javascript', 'embeddedFiles']
```

Each class is opt-out via options (all default to `true`):

```ts
interface SanitizeOptions {
  javascript?: boolean;     // document JS name tree + JS-typed /AA actions
  openActions?: boolean;    // catalog /OpenAction
  embeddedFiles?: boolean;  // /Names/EmbeddedFiles tree + /AF
  metadata?: boolean;       // XMP /Metadata stream + descriptive /Info fields
}

// Strip scripts but keep attachments:
const { pdf } = await sanitizePdf(pdfBytes, { embeddedFiles: false });
```

`report.removed` lists only classes that were genuinely present, so a freshly
created clean document yields `removed: []`. The sanitized PDF re-parses
without error.

::: warning Scope
Sanitization targets document-level active content reachable from the catalog
and page `/AA`. It does not attempt to strip JavaScript hidden inside individual
widget/annotation action dictionaries beyond page `/AA`, nor scripts embedded in
content streams.
:::

## Verifying redactions

A redaction is only secure if the underlying content is actually *gone*. A
common failure is a black rectangle drawn over text that remains extractable.
`verifyRedactions` extracts text positions and reports any text whose bounding
box intersects a redaction region — a **leak**.

It reads only the page content stream: it does not follow Form XObjects,
patterns or annotation appearances. The box of each text run is an estimate
(0.5 em per character, height equal to the font size), and any overlap counts
as a leak.

```ts
import { verifyRedactions } from 'modern-pdf-lib';

const report = await verifyRedactions(pdfBytes, [
  { page: 0, x: 72, y: 700, width: 200, height: 14 },
]);
for (const leak of report.leaks) {
  console.warn(`Leak on page ${leak.page}: "${leak.text}" at (${leak.x}, ${leak.y})`);
}
console.warn(report.warnings[0]); // what the verifier cannot see
```

```ts
interface RedactionRegion { page: number; x: number; y: number; width: number; height: number; }
interface RedactionLeak { page: number; text: string; x: number; y: number; }
interface RedactionVerificationReport {
  leaks: RedactionLeak[];
  clean: boolean;          // always false
  regionsChecked: number;
  warnings: string[];      // always one sentence on what the verifier cannot see
}
```

Coordinates are **PDF user space — origin bottom-left, y-up, units in points**,
matching the rest of the library (a region's `(x, y)` is its lower-left corner).

`clean` is always `false`: the verifier can find text in a region but cannot
prove a region free of text (it does not follow Form XObjects, patterns or
annotation appearances), and `warnings` always holds one sentence saying so. An
empty `leaks` means only that no text was found.

`verifyRedactions` throws a `TypeError` when `regions` is missing or empty, and
a `RangeError` when a region names a page that does not exist.

::: tip `regions` is required
You must pass the regions to check. Auto-detecting redaction rectangles from a
loaded PDF is not reliable (a black fill is indistinguishable from legitimate
graphics, and parsed `/Redact` annotations are not exposed through a stable
accessor), so the verifier requires explicit regions rather than guessing. Pass
the rectangles that were meant to be redacted.
:::

## Inspecting encryption & permissions

`inspectEncryption` reports a document's encryption scheme and decodes its
permission flags (ISO 32000 Table 22) without needing the password.

```ts
import { inspectEncryption } from 'modern-pdf-lib';

const report = await inspectEncryption(pdfBytes);
if (report.encrypted) {
  console.log(`${report.method?.toUpperCase()} ${report.keyBits}-bit, V${report.version}/R${report.revision}`);
  console.log('Handler:', report.handler);                 // 'password' | 'publicKey'
  console.log('Empty user password:', report.emptyUserPassword);
  console.log('Can print:', report.permissions?.print);
}
```

```ts
interface EncryptionReport {
  encrypted: boolean;
  method?: 'rc4' | 'aes';
  keyBits?: number;            // 40 | 128 | 256
  version?: number;            // /V
  revision?: number;           // /R
  handler?: 'password' | 'publicKey';
  emptyUserPassword?: boolean; // opens with an empty user password?
  permissions?: PermissionFlags;
}
interface PermissionFlags {
  print: boolean; modify: boolean; copy: boolean; annotate: boolean;
  fillForms: boolean; extract: boolean; assemble: boolean; printHighRes: boolean;
}
```

It recognises RC4-40 (V1/R2), RC4-128 (V2/R3), AES-128 (V4/R4, `/AESV2`), and
AES-256 (V5/R6, `/AESV3`), and distinguishes the `/Standard` (password) handler
from `/Adobe.PubSec` (public-key). The inspector is read-only — it never
decrypts content (it only tests empty-password key derivation).

## See also

- **Redaction marks** — `markForRedaction` records regions; `applyRedactions`
  throws `RedactionIncompleteError` (code `redaction-incomplete`, reason
  `redaction-unavailable`) in this release and changes nothing. So do
  `applyRedaction`, `PdfDocument.applyRedactions()` and
  [`redactRegions`](./rendering.md#redaction-by-content-removal). A later
  release adds redaction by removal.
- **Encryption** — apply password protection (RC4 or AES-128; AES-256 output is not yet readable by other PDF readers) with
  `await doc.encrypt(options)`, then `save()`; for an encrypted document,
  `saveAsStream()`, a save with an `objectStreamThreshold` other than
  `Infinity` (the default) and `saveDocumentIncremental()` throw
  `UnsupportedEncryptionError` (code `unsupported-encryption-path`). The
  functions that sign or append an incremental update to PDF bytes
  (`signPdf`, `prepareForSigning`, `addCounterSignature`, `embedLtvData`,
  `saveIncremental`, `saveIncrementalWithSignaturePreservation`,
  `optimizeIncrementalSave` and `appendIncrementalUpdate`) throw the same
  error for an encrypted file,
  because they do not encrypt what they append. `linearizePdf` throws it for an
  encrypted file too, and `delinearizePdf` for a linearized file that has `/Encrypt`. `flattenTransparency`, `stripProhibitedFeatures`, `enforcePdfA`, `enforcePdfAFull` and `enforcePdfX` throw it for an encrypted file too. For the sixteen functions named here that take PDF bytes (all of them except `saveAsStream()`), a file counts as encrypted when its bytes contain the name `/Encrypt` anywhere, whatever follows it; a name written with `#` escapes, such as `/Encr#79pt`, counts, and `/EncryptMetadata` and `/Encrypt2` do not, except in `enforcePdfA`, `enforcePdfAFull` and `enforcePdfX`, which also refuse any file whose text contains `/Encrypt`, so `/EncryptMetadata` and `/Encrypt2` as well. An unencrypted file that holds the name `/Encrypt` anywhere outside a compressed stream, for example inside an uncompressed content stream or as text that looks like a name, is refused as well. Inspect an existing document
  with `inspectEncryption` above.
- **Signatures** — [digital signatures & PAdES](./signatures.md).
