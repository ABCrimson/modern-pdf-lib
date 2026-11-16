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

> [!NOTE]
> `scanPdfThreats` and `inspectEncryption` throw `ResourceLimitError` (code
> `resource-limit-exceeded`) for a file that an internal limit refuses, because a
> refused file is not a file without findings: treat it as rejected. The limits
> bound one stream, table or call, not a process, so run each untrusted file in a
> worker or child process with its own time and memory limit. The values are
> listed under [Input limits](./performance.md#input-limits).

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

`verifyRedactions` throws an `InvalidArgumentError` when `regions` is missing or
empty (`argument` is `"regions"`), and when a region names a page that does not
exist (`argument` is `"regions[i].page"`, where `i` is the index of the region).

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

## Loading and saving encrypted documents

`loadPdf()` of an encrypted file with the right password returns the document with its objects decrypted. This covers RC4 with 40-bit and 128-bit keys, AES-128 and AES-256, files that keep objects in object streams, crypt filters, and `/EncryptMetadata false`. In the oracle tests the decrypted objects equal the output of `qpdf --decrypt --qdf` object by object. The one documented difference is the `/Contents` of a signature dictionary, which stays as stored in the file.

The password rules:

- Either the user password or the owner password opens a file. The owner password of a file whose `/U` entry is longer than 48 bytes is accepted.
- For AES-256 the library writes the SASLprep form of a password. On reading it tries the SASLprep form first, then the raw UTF-8 bytes, which is what qpdf and pdf.js hash.
- A wrong password throws an `EncryptedPdfError` with `reason` `"incorrect-password"`; no password, on a file that needs one, throws it with `reason` `"password-required"`.

### What fails closed

These cases throw `UnsupportedEncryptionError` (code `unsupported-encryption-path`) instead of returning data that is still encrypted:

- a security handler other than Standard;
- an unknown `/V` or crypt filter method, or a crypt filter name that the file does not define;
- a direct or recovered `/Encrypt` dictionary that the library cannot honour;
- AES data that is damaged, for example too short to hold an initialization vector and a block.

A `ResourceLimitError` is never swallowed on this path.

### Saving a decrypted document

A document decrypted on load cannot be written until `encrypt()` has been called on the document being saved. `isEncrypted()` stays `false` after the load, because no protection is configured for the output until you call `encrypt()`. Until `encrypt()` is called, every route that produces bytes throws `UnsupportedEncryptionError`, so plaintext never leaves by accident:

- `save()`, `saveAsStream()`, `saveAsBlob()`, `saveAsBase64()`, `serializePdf()`, `PdfWriter` and `PdfStreamWriter`;
- `saveIncremental()` and `saveDocumentIncremental()`;
- `sanitizePdf()` on an encrypted file that opens with the empty user password;
- a document that received pages, objects or metadata from such a document through `copy()`, `copyPages()`, `mergePdfs()`, `splitPdf()` or the embed calls;
- a document that received a page of such a document through `addPage()`.
- a document that holds a string or stream decrypted on load, whatever route put it there.

`copy()` of such a document does not call the `onAfterSave` hooks of registered plugins, because it would hand them the unencrypted bytes.

After `encrypt()`, `save()`, `saveAsBlob()`, `saveAsBase64()`, `serializePdf()` and `PdfWriter` write the document encrypted with the new parameters. `saveAsStream()`, `PdfStreamWriter`, `saveIncremental()`, `saveDocumentIncremental()` and `sanitizePdf()` stay refused, because they cannot encrypt what they write. A load with `ignoreEncryption: true` is a different case: it returns the streams as stored in the file, and saving it writes them as loaded.

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { loadPdf } from 'modern-pdf-lib';

// Load with the password the file was encrypted with.
const source = new Uint8Array(await readFile('protected.pdf'));
const doc = await loadPdf(source, { password: 'old-password' });

// ... read, extract or edit the document here ...

// Choose the protection of the output. Without this call, save() throws.
await doc.encrypt({
  userPassword: 'new-user-password',
  ownerPassword: 'new-owner-password',
  algorithm: 'aes-256',
});
await writeFile('re-encrypted.pdf', await doc.save());
```

The saved file is a new encryption of the decrypted objects, not a byte copy of the source: strings that hold bytes above 0x7F are rewritten on save until 0.41.0 (see Known limits below). The re-encrypted document does not keep the permissions of the source. Called without a `permissions` argument, `encrypt()` denies every permission: measured with qpdf 12.4.2, a source that allowed printing and everything else came out with `/P` -3904, all denied. To grant some, pass them, for example `permissions: { printing: true, copying: true }`, which gave `/P` -1836 (printing and extraction allowed, the rest denied).

The save rule covers what the library itself writes. It does not cover content that you read from a decrypted document and feed back through the API, or content the library derives from it, such as extracted text; what you do with those is up to the code that handles them.

The same code opens an AES-256 file written by qpdf, and a file this library wrote with any version from 0.26.0 on.

### Files written by 0.26.0 to 0.40.8

Versions 0.26.0 to 0.40.8 wrote AES-256 (revision 6) files with a password hash that deviates from ISO 32000-2 Algorithm 2.B. Other PDF software, such as qpdf and pdf.js, does not accept those files. This version writes the standard derivation, and still opens the older files with their passwords. Opening one emits a single warning per process:

```
[MPL_LEGACY_R6_KEY] ModernPdfLibWarning: The AES-256 key of this document was derived the way
modern-pdf-lib 0.26.0 to 0.40.8 wrote it, which other PDF software does not accept. Call
encrypt() and save to write it with the standard derivation.
```

To act on it, call `encrypt()` on the loaded document, as in the sample above, and save. The new file uses the standard derivation and is never written with the old one. To silence the warning in Node, start the process with `--disable-warning=MPL_LEGACY_R6_KEY` (or `--disable-warning=ModernPdfLibWarning` for every warning of this library), or set it in `NODE_OPTIONS`. The library has no hook of its own for warnings.

### Compatibility of AES-256 files

Every cell was measured: the published 0.40.3 package, the 0.40.8 code, this version, qpdf 12.4.2 and pdf.js 6.5.438, each opening the file with its user password. Versions 0.40.4 to 0.40.7 have the same key derivation code as 0.40.3 and 0.40.8 and were not run separately.

| File written by | This version | 0.40.3 and 0.40.8 | qpdf | pdf.js |
|---|---|---|---|---|
| This version (0.40.9 on) | Opens | Refused: the password is reported as incorrect | Opens, `--check` clean | Opens, text correct |
| This library, 0.26.0 to 0.40.8 | Opens with one `MPL_LEGACY_R6_KEY` warning | Opens, but the content stays encrypted, so text extraction throws (compressed streams) or returns no text | Refused: invalid password | Refused: incorrect password |
| qpdf (AES-256, revision 6) | Opens | Refused: the password is reported as incorrect | Opens | Opens |

An AES-256 file written from 0.40.9 on therefore cannot be opened by 0.40.3 to 0.40.8. Files written with RC4 or AES-128 are not affected.

### Known limits

- Strings that hold bytes above 0x7F are rewritten on save. This applies to a decrypted document that is re-encrypted and saved. A fix is planned for 0.41.0.
- Incremental and streamed saves of an encrypted document are planned for 0.41.2. Until then they throw, as listed above.

## See also

- **Redaction marks** — `markForRedaction` records regions; `applyRedactions`
  throws `RedactionIncompleteError` (code `redaction-incomplete`, reason
  `redaction-unavailable`) in this release and changes nothing. So do
  `applyRedaction`, `PdfDocument.applyRedactions()` and
  [`redactRegions`](./rendering.md#redaction-by-content-removal). A later
  release adds redaction by removal.
- **Encryption** — apply password protection (RC4, AES-128 or AES-256) with
  `await doc.encrypt(options)`, then `save()`; see [Loading and saving encrypted documents](#loading-and-saving-encrypted-documents) for a document loaded from an encrypted file; for an encrypted document,
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
