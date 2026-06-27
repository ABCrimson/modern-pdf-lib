# Security & Redaction Auditing

Beyond creating and signing PDFs, modern-pdf-lib ships a hardening layer for
**auditing** untrusted documents: a static threat scanner, a content sanitizer,
a redaction-leak verifier, and an encryption/permission inspector. These tools
inspect or clean an existing PDF — active redaction itself lives in the
[core redaction API](#see-also).

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

```ts
import { verifyRedactions } from 'modern-pdf-lib';

const report = await verifyRedactions(pdfBytes, [
  { page: 0, x: 72, y: 700, width: 200, height: 14 },
]);
if (!report.clean) {
  for (const leak of report.leaks) {
    console.warn(`Leak on page ${leak.page}: "${leak.text}" at (${leak.x}, ${leak.y})`);
  }
}
```

```ts
interface RedactionRegion { page: number; x: number; y: number; width: number; height: number; }
interface RedactionLeak { page: number; text: string; x: number; y: number; }
interface RedactionVerificationReport { leaks: RedactionLeak[]; clean: boolean; regionsChecked: number; }
```

Coordinates are **PDF user space — origin bottom-left, y-up, units in points**,
matching the rest of the library (a region's `(x, y)` is its lower-left corner).
`clean === (leaks.length === 0)`.

::: tip `regions` is required
You must pass the regions to check. Auto-detecting redaction rectangles from a
loaded PDF is not reliable (a black fill is indistinguishable from legitimate
graphics, and parsed `/Redact` annotations are not exposed through a stable
accessor), so the verifier requires explicit regions rather than guessing. Use
the same rectangles you passed to the redaction step.
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

- **Active redaction** — `markForRedaction` / `applyRedactions` burn redactions
  into the page content (verify the result with `verifyRedactions` above).
- **Encryption** — apply password or AES-256 protection when saving via the
  `EncryptOptions` passed to `save()`; inspect an existing document with
  `inspectEncryption` above.
- **Signatures** — [digital signatures & PAdES](./signatures.md).
