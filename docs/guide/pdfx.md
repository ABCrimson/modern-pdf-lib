---
title: PDF/X Compliance
---

# PDF/X Compliance

modern-pdf-lib includes validation and enforcement tools for PDF/X, the ISO 15930 standard for reliable exchange of print-ready PDF files. PDF/X restricts certain PDF features and mandates others to ensure predictable reproduction in commercial print workflows.

---

## Supported Conformance Levels

| Level | ISO Standard | Color Spaces | Transparency | PDF Version |
|---|---|---|---|---|
| **X-1a:2003** | ISO 15930-4 | CMYK/Gray only | Prohibited | PDF 1.3 |
| **X-3:2003** | ISO 15930-6 | CMYK/Gray + ICC-based RGB | Prohibited | PDF 1.3 |
| **X-4** | ISO 15930-7 | ICC-based color management | Allowed | PDF 1.6+ |

::: tip Choosing a Level
- Use **X-4** for modern print workflows -- it supports transparency and ICC-based color management.
- Use **X-1a:2003** when your print shop requires strict CMYK-only output with no transparency.
- Use **X-3:2003** when you need RGB support but your prepress tools do not handle transparency.
:::

---

## Validating a PDF

Use `validatePdfX()` to check whether a PDF conforms to a specific PDF/X level:

```ts
import { readFile } from 'node:fs/promises';
import { validatePdfX } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('print-ready.pdf'));
const result = validatePdfX(bytes, 'X-4');

if (result.valid) {
  console.log(`Document is PDF/X-4 compliant!`);
} else {
  for (const error of result.errors) {
    console.error(`[${error.code}] ${error.message}`);
    if (error.clause) console.error(`  ISO clause: ${error.clause}`);
  }
  for (const warning of result.warnings) {
    console.warn(`[${warning.code}] ${warning.message}`);
  }
}
```

### Validation Checks

The validator performs the following structural checks on the raw PDF bytes:

| Code | Check | Applies To |
|---|---|---|
| `PDFX-001` | `/OutputIntents` array present in catalog | All levels |
| `PDFX-002` | Output intent uses `/S /GTS_PDFX` subtype | All levels |
| `PDFX-003` | `/Trapped` key in Info dictionary | All levels |
| `PDFX-004` | No transparency (SMask, CA/ca, blend modes) | X-1a, X-3 |
| `PDFX-005` | Color space restrictions (no DeviceRGB for X-1a) | X-1a, X-3 |
| `PDFX-006` | All fonts embedded | All levels |
| `PDFX-007` | No encryption | All levels |
| `PDFX-008` | TrimBox or BleedBox on every page | All levels |
| `PDFX-009` | No JavaScript | All levels |
| `PDFX-010` | No multimedia (RichMedia, Movie, Sound) | All levels |
| `PDFX-011` | PDF version >= 1.6 (X-4 only) | X-4 |
| `PDFX-012..015` | Page box nesting (MediaBox >= BleedBox >= TrimBox >= ArtBox) | All levels |

---

## Enforcing PDF/X

Use `enforcePdfX()` to auto-correct common compliance issues:

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { enforcePdfX } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('document.pdf'));

const compliant = enforcePdfX(bytes, {
  level: 'X-4',
  outputIntent: {
    condition: 'CGATS TR 001',
    registryName: 'http://www.color.org',
    info: 'sRGB IEC61966-2.1',
  },
  trapped: 'False',
});

await writeFile('print-ready.pdf', compliant);
```

### What Enforcement Fixes

| Action | Description |
|---|---|
| Output intent | Adds `/OutputIntents` with `/GTS_PDFX` subtype if missing |
| Trapped key | Sets `/Trapped` in the Info dictionary |
| TrimBox | Copies CropBox (or MediaBox) to TrimBox on pages missing both TrimBox and BleedBox |
| Transparency flattening | Resets CA/ca to 1, SMask to /None, BM to /Normal (X-1a and X-3 only) |

::: warning Limitations
`enforcePdfX()` cannot fix all issues automatically:
- **RGB to CMYK conversion** -- cannot convert DeviceRGB to CMYK (X-1a will still fail validation)
- **Font embedding** -- cannot embed fonts that are not already embedded
- **Encryption** -- throws an error if the document is encrypted
- **JavaScript** -- throws an error if the document contains JavaScript

Remove encryption and JavaScript before calling `enforcePdfX()`.
:::

---

## Building Output Intents

For programmatic PDF creation, use `buildPdfXOutputIntent()` to construct a standards-compliant output intent dictionary:

```ts
import { createPdf, buildPdfXOutputIntent } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const doc = createPdf();
const registry = doc.getRegistry();

// Load an ICC profile
const iccProfile = new Uint8Array(await readFile('FOGRA39.icc'));

const intentRef = buildPdfXOutputIntent(registry, {
  condition: 'FOGRA39',
  registryName: 'http://www.color.org',
  info: 'Coated FOGRA39 (ISO 12647-2:2004)',
  iccProfile,
});

// Add the intent to the document catalog
// (wire intentRef into the catalog's /OutputIntents array)
```

### Output Intent Options

```ts
interface OutputIntentConfig {
  condition: string;         // Output condition identifier
  registryName?: string;     // Registry URL (e.g. "http://www.color.org")
  iccProfile?: Uint8Array;   // ICC profile bytes
  info?: string;             // Human-readable description
}
```

---

## Complete Print Production Workflow

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { validatePdfX, enforcePdfX } from 'modern-pdf-lib';

async function prepareForPrint(inputPath: string, outputPath: string) {
  let bytes = new Uint8Array(await readFile(inputPath));

  // Step 1: Enforce PDF/X-4 compliance
  bytes = enforcePdfX(bytes, {
    level: 'X-4',
    outputIntent: {
      condition: 'CGATS TR 001',
      registryName: 'http://www.color.org',
      info: 'sRGB IEC61966-2.1',
    },
  });

  // Step 2: Validate the result
  const result = validatePdfX(bytes, 'X-4');

  if (result.valid) {
    console.log('Document is print-ready (PDF/X-4)');
  } else {
    console.warn(`${result.errors.length} errors remain:`);
    for (const error of result.errors) {
      console.warn(`  [${error.code}] ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.info(`${result.warnings.length} warnings:`);
    for (const warning of result.warnings) {
      console.info(`  [${warning.code}] ${warning.message}`);
    }
  }

  await writeFile(outputPath, bytes);
}

await prepareForPrint('document.pdf', 'print-ready.pdf');
```

---

## PDF/X vs PDF/A

Both are ISO standards for restricting PDF features, but they serve different purposes:

| Aspect | PDF/X (ISO 15930) | PDF/A (ISO 19005) |
|---|---|---|
| Purpose | Print production exchange | Long-term archival |
| Key requirement | Output intent with ICC profile | XMP metadata with PDF/A ID |
| Color management | Strict (CMYK for X-1a, ICC-based) | Flexible (with output intent) |
| Transparency | Prohibited in X-1a/X-3, allowed in X-4 | Prohibited in PDF/A-1, allowed in PDF/A-2+ |
| Encryption | Prohibited | Prohibited |
| JavaScript | Prohibited | Prohibited |

::: tip
A document can conform to both PDF/X and PDF/A simultaneously. This is common for archival-quality print files. Validate against both standards independently.
:::

---

## API Reference

| Export | Description |
|---|---|
| `validatePdfX(bytes, level)` | Validate PDF bytes against a PDF/X level |
| `enforcePdfX(bytes, options)` | Enforce PDF/X compliance (auto-fix) |
| `buildPdfXOutputIntent(registry, config)` | Build an output intent dictionary |
| `PdfXLevel` | `'X-1a:2003' \| 'X-3:2003' \| 'X-4'` |
| `PdfXValidationResult` | `{ valid, level, errors, warnings }` |
| `PdfXIssue` | `{ code, message, clause? }` |
| `PdfXOptions` | `{ level, outputIntent, trapped? }` |
| `OutputIntentConfig` | `{ condition, registryName?, iccProfile?, info? }` |
