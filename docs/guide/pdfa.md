---
title: PDF/A Compliance
---

# PDF/A Compliance Guide

modern-pdf-lib provides comprehensive tools for creating, validating, and enforcing PDF/A compliance across all major conformance levels. Whether you need to archive documents for long-term preservation or embed machine-readable invoices with ZUGFeRD/Factur-X, the compliance module has you covered.

---

## What is PDF/A?

PDF/A is an ISO standard (ISO 19005) for long-term archival of electronic documents. It restricts certain PDF features and mandates others to ensure documents remain readable for decades without depending on specific software, fonts, or external resources.

| Standard | ISO | Based On | Key Features |
|---|---|---|---|
| **PDF/A-1** | ISO 19005-1:2005 | PDF 1.4 | No transparency, no JPEG2000, no embedded files |
| **PDF/A-2** | ISO 19005-2:2011 | PDF 1.7 | Allows transparency, JPEG2000, layers |
| **PDF/A-3** | ISO 19005-3:2012 | PDF 1.7 | Same as PDF/A-2 + embedded files of any type |

### Conformance Levels

Each PDF/A part defines up to three conformance levels:

| Level | Name | Requirements |
|---|---|---|
| **b** | Basic | Visual appearance preservation only |
| **u** | Unicode | Adds Unicode mapping for all text (makes text searchable/extractable) |
| **a** | Accessible | Adds logical structure tree (tagged PDF) for full accessibility |

::: tip Choosing a Level
- Use **PDF/A-2b** for most new documents — it is the most practical level for modern workflows.
- Use **PDF/A-3b** when you need to embed files (e.g., e-invoicing with ZUGFeRD/Factur-X).
- Use **PDF/A-1b** only when strict PDF 1.4 compatibility is required.
:::

---

## Quick Start

### Validating a PDF

```typescript
import { readFile } from 'node:fs/promises';
import { validatePdfA } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('document.pdf'));
const result = validatePdfA(bytes, '2b');

if (result.valid) {
  console.log('Document is PDF/A-2b compliant!');
} else {
  for (const issue of result.issues) {
    console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
  }
}
```

The validator checks for the following issues:

| Code | Check | Severity |
|---|---|---|
| `PDFA-001` | XMP metadata stream present | Error |
| `PDFA-002` | PDF/A identification in XMP | Error |
| `PDFA-003` | No encryption | Error |
| `PDFA-004` | No JavaScript | Error |
| `PDFA-005` | File identifier (`/ID`) in trailer | Error |
| `PDFA-006` | No transparency (PDF/A-1 only) | Error |
| `PDFA-007` | Structure tree present (`/StructTreeRoot`, level `a` only) | Error |
| `PDFA-008` | Mark info present (`/MarkInfo`, level `a` only) | Error |
| `PDFA-009` | ToUnicode CMaps (level `u` and `a`, part 2+) | Warning |
| `PDFA-010` | No embedded files (parts 1 and 2) | Error |
| `PDFA-011` | Document language (`/Lang`) | Warning |
| `PDFA-012` | Output intents for device-dependent color spaces | Warning |
| `PDFA-013` | Standard 14 fonts must be embedded | Error |

### Enforcing PDF/A Compliance

```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { enforcePdfA } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('document.pdf'));
const compliant = await enforcePdfA(bytes, '2b');
await writeFile('document-pdfa.pdf', compliant);
```

`enforcePdfA` adds or corrects:
- XMP metadata with PDF/A identification (`pdfaid:part`, `pdfaid:conformance`)
- File identifier (`/ID`) in the trailer

::: warning Limitations
`enforcePdfA` cannot fix all compliance issues automatically. It will **throw** if the document is encrypted or contains JavaScript. Use `stripProhibitedFeatures` first to remove those. Font embedding and structure tree creation require manual intervention.
:::

---

## Conformance Levels in Detail

### PDF/A-1b — Basic Visual Preservation

The most common and widely supported level. Ensures the document looks the same on every system, indefinitely.

**Requirements:**
- All fonts must be embedded (standard 14 fonts are **not** exempt)
- No encryption
- No JavaScript or other executable actions
- No transparency (no soft masks, opacity must be 1.0)
- XMP metadata with PDF/A identification
- File identifier (`/ID`) in the trailer
- Output intent with ICC profile for device-dependent color spaces

**Prohibited features:**
- `/JavaScript`, `/JS` actions
- `/Launch`, `/Sound`, `/Movie` actions
- `/RichMedia` annotations
- Encryption (`/Encrypt`)
- Transparency (`/SMask`, `/CA` < 1.0, `/ca` < 1.0, non-Normal `/BM`)

### PDF/A-2b — Modern Visual Preservation

Builds on PDF/A-1b while allowing modern PDF features.

**Additional features allowed (compared to PDF/A-1):**
- Transparency and blend modes
- JPEG2000 compression
- Optional Content Groups (layers)
- PDF packages

### PDF/A-3b — Embedded Files

Identical to PDF/A-2b, plus embedded files of any type with defined relationships. This is the level required for e-invoicing standards like ZUGFeRD and Factur-X.

---

## Transparency Handling

PDF/A-1 prohibits all transparency. If you need to convert a document with transparency to PDF/A-1, you can detect and flatten it:

```typescript
import { detectTransparency, flattenTransparency } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('document.pdf'));

// Detect transparency usage
const info = detectTransparency(bytes);
if (info.hasTransparency) {
  console.log(`Found ${info.findings.length} transparency features:`);
  console.log(`  Stroke opacity (CA < 1): ${info.strokeOpacityCount}`);
  console.log(`  Fill opacity (ca < 1):   ${info.fillOpacityCount}`);
  console.log(`  Soft masks (SMask):      ${info.softMaskCount}`);
  console.log(`  Blend modes (BM):        ${info.blendModeCount}`);

  // Flatten for PDF/A-1 compliance
  const flattened = flattenTransparency(bytes);
  await writeFile('flattened.pdf', flattened);
}
```

Flattening replaces:
- `/CA <value>` (stroke opacity) with `/CA 1`
- `/ca <value>` (fill opacity) with `/ca 1`
- `/SMask <ref>` with `/SMask /None`
- `/BM /<mode>` with `/BM /Normal`

::: warning Lossy Operation
Flattening is lossy — semi-transparent elements become fully opaque. For print-quality output, manual review is recommended. If your workflow allows it, target PDF/A-2b instead, which permits transparency.
:::

---

## XMP Metadata

PDF/A mandates XMP metadata with specific properties. The compliance module provides both validation and generation.

### Validating XMP Metadata

```typescript
import { validateXmpMetadata } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('document.pdf'));
const result = validateXmpMetadata(bytes, '2b');

console.log('Valid:', result.valid);
console.log('Metadata:', result.metadata);
for (const issue of result.issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}
```

The XMP validator checks:

| Code | Property | Required |
|---|---|---|
| `XMP-002` | `pdfaid:part` | Mandatory |
| `XMP-004` | `pdfaid:conformance` | Mandatory |
| `XMP-006` | `pdfaid` namespace declaration | Mandatory |
| `XMP-007` | `xmp:CreatorTool` | Recommended |
| `XMP-008` | `xmp:CreateDate` | Recommended |
| `XMP-009` | `xmp:ModifyDate` | Recommended |
| `XMP-010` | `pdf:Producer` | Recommended |
| `XMP-011` | `dc:title` | Recommended |

### Generating XMP Metadata

```typescript
import { generatePdfAXmp, generatePdfAXmpBytes } from 'modern-pdf-lib';

// Generate XMP as a string
const xmpString = generatePdfAXmp({
  part: 2,
  conformance: 'B',
  title: 'Annual Report 2026',
  author: 'Finance Department',
  subject: 'Company annual financial report',
  creatorTool: 'modern-pdf-lib',
  producer: 'modern-pdf-lib',
  language: 'en',
});

// Or as bytes for embedding in a PDF stream
const xmpBytes = generatePdfAXmpBytes({
  part: 3,
  conformance: 'B',
  title: 'Invoice INV-2026-001',
});
```

---

## Stripping Prohibited Features

Before enforcing PDF/A, you may need to remove prohibited features. The `stripProhibitedFeatures` function neutralizes them:

```typescript
import { stripProhibitedFeatures } from 'modern-pdf-lib';

const bytes = new Uint8Array(await readFile('document.pdf'));
const result = stripProhibitedFeatures(bytes);

if (result.modified) {
  console.log('Stripped features:');
  for (const feature of result.stripped) {
    console.log(`  ${feature.type}: ${feature.count} occurrence(s)`);
  }
  await writeFile('cleaned.pdf', result.bytes);
}
```

You can selectively control which features to strip:

```typescript
const result = stripProhibitedFeatures(bytes, {
  stripJavaScript: true,   // /JS, /JavaScript actions (default: true)
  stripLaunch: true,        // /Launch actions (default: true)
  stripSound: true,         // /Sound actions (default: true)
  stripMovie: true,         // /Movie actions (default: true)
  stripRichMedia: true,     // /RichMedia annotations (default: true)
});
```

---

## Output Intents and ICC Profiles

PDF/A requires an output intent with an embedded ICC profile when device-dependent color spaces (`DeviceRGB`, `DeviceCMYK`, `DeviceGray`) are used. The library includes a built-in minimal sRGB ICC v2 profile.

```typescript
import { buildOutputIntent, SRGB_ICC_PROFILE } from 'modern-pdf-lib';

// Build with default sRGB profile
const intentRef = buildOutputIntent(registry);

// Or customize the output intent
const intentRef2 = buildOutputIntent(registry, {
  subtype: '/GTS_PDFA1',
  outputCondition: 'sRGB',
  outputConditionIdentifier: 'sRGB IEC61966-2.1',
  registryName: 'http://www.color.org',
  iccProfile: customIccBytes,  // optional: provide your own ICC profile
  components: 3,               // 3 for RGB, 4 for CMYK, 1 for Gray
});
```

---

## Profile Definitions

Query the built-in profile definitions to understand what each level allows:

```typescript
import { getProfile, getSupportedLevels, isValidLevel } from 'modern-pdf-lib';

// List all supported levels
const levels = getSupportedLevels();
// ['1a', '1b', '2a', '2b', '2u', '3a', '3b', '3u']

// Check if a level string is valid
if (isValidLevel('2b')) {
  const profile = getProfile('2b');
  console.log(profile.pdfVersion);           // '1.7'
  console.log(profile.allowsTransparency);   // true
  console.log(profile.allowsJpeg2000);       // true
  console.log(profile.allowsLayers);         // true
  console.log(profile.allowsEmbeddedFiles);  // false
  console.log(profile.requiresStructureTree); // false
  console.log(profile.requiresToUnicode);    // false
  console.log(profile.outputIntentSubtype);  // '/GTS_PDFA1'
}
```

---

## E-Invoicing with ZUGFeRD / Factur-X

ZUGFeRD (and its international equivalent Factur-X) is a European standard for hybrid electronic invoices. It combines a human-readable PDF/A-3 document with a machine-readable XML invoice embedded as an associated file.

### How It Works

1. Create a visual PDF invoice (the human-readable part)
2. Generate the structured XML invoice data (the machine-readable part)
3. Embed the XML as a PDF/A-3 associated file with the `Alternative` relationship
4. Enforce PDF/A-3b compliance on the final document

### Creating a ZUGFeRD Invoice

```typescript
import {
  createPdf,
  PageSizes,
  rgb,
  createAssociatedFile,
  buildAfArray,
  buildOutputIntent,
  generatePdfAXmpBytes,
  enforcePdfA,
} from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

// --- Step 1: Create the visual invoice ---
const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawText('INVOICE', {
  x: 50, y: 780, size: 28,
  color: rgb(0.1, 0.1, 0.1),
});
page.drawText('Invoice Number: INV-2026-001', {
  x: 50, y: 740, size: 12,
});
page.drawText('Date: 2026-03-07', {
  x: 50, y: 720, size: 12,
});
page.drawText('Due Date: 2026-04-06', {
  x: 50, y: 700, size: 12,
});

// Line items
page.drawText('Description              Qty    Unit Price    Total', {
  x: 50, y: 660, size: 10,
});
page.drawText('Web Development          10     €100.00       €1,000.00', {
  x: 50, y: 640, size: 10,
});
page.drawText('Design Services           3     €78.19         €234.56', {
  x: 50, y: 620, size: 10,
});

page.drawText('Total: EUR 1,234.56', {
  x: 50, y: 580, size: 16,
  color: rgb(0, 0.4, 0),
});

// --- Step 2: Prepare the ZUGFeRD XML ---
const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>INV-2026-001</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">20260307</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>1234.56</ram:TaxBasisTotalAmount>
        <ram:GrandTotalAmount>1234.56</ram:GrandTotalAmount>
        <ram:DuePayableAmount>1234.56</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

// --- Step 3: Embed the XML as an associated file ---
const xmlBytes = new TextEncoder().encode(invoiceXml);
const registry = doc.getRegistry();

const { fileSpecRef } = createAssociatedFile(registry, {
  data: xmlBytes,
  filename: 'factur-x.xml',
  mimeType: 'text/xml',
  relationship: 'Alternative',
  description: 'Factur-X invoice data (Minimum profile)',
});

// Add the /AF array to the catalog
const afArray = buildAfArray([fileSpecRef]);
// (Wire afArray and fileSpecRef into the catalog's /AF and
//  /Names/EmbeddedFiles — see your document's registry API)

// --- Step 4: Save and enforce PDF/A-3b ---
const pdfBytes = await doc.save();
const compliant = await enforcePdfA(pdfBytes, '3b');
await writeFile('invoice-zugferd.pdf', compliant);
```

### ZUGFeRD / Factur-X Profiles

ZUGFeRD defines several profiles with increasing detail:

| Profile | Description | Use Case |
|---|---|---|
| **Minimum** | Basic invoice reference (ID, date, total) | Simple invoices, archival |
| **Basic WL** | Core invoice data without line items | Standard B2B invoices |
| **Basic** | Full basic data with line items | Automated processing |
| **EN 16931** | Full EU standard compliance (EN 16931) | Cross-border EU invoices |
| **Extended** | Maximum detail with all optional fields | Complex invoices, EDI replacement |
| **XRechnung** | German government profile (based on EN 16931) | German public sector |

::: info XML Schema
The ZUGFeRD/Factur-X XML is based on the UN/CEFACT Cross Industry Invoice (CII) standard. The XML schema and profile-specific rules are defined in the [ZUGFeRD specification](https://www.ferd-net.de/) and [Factur-X specification](https://fnfe-mpe.org/factur-x/).
:::

### Associated File Relationships

When embedding files in PDF/A-3, you must declare the relationship between the embedded file and the PDF document:

```typescript
import { createAssociatedFile } from 'modern-pdf-lib';

const result = createAssociatedFile(registry, {
  data: xmlBytes,
  filename: 'factur-x.xml',
  mimeType: 'text/xml',
  relationship: 'Alternative',  // The XML is an alternative representation
  description: 'ZUGFeRD invoice data',
  creationDate: '2026-03-07T10:00:00Z',
  modificationDate: '2026-03-07T10:00:00Z',
});

// result.fileSpecRef — reference to the file specification dictionary
// result.streamRef   — reference to the embedded file stream
```

Available relationship types:

| Relationship | Meaning | Common Use |
|---|---|---|
| `Source` | The file is the source from which the PDF was created | Original document |
| `Data` | The file contains data represented in the PDF | Data exports |
| `Alternative` | Alternative representation of the PDF content | **ZUGFeRD/Factur-X** |
| `Supplement` | Supplementary information | Attachments |
| `EncryptedPayload` | Encrypted payload | Secure documents |
| `FormData` | Form data (XFA) | Form submissions |
| `Schema` | Schema definition | Validation schemas |
| `Unspecified` | No specific relationship | Other |

---

## Complete Compliance Workflow

For production use, here is a recommended workflow that combines multiple compliance tools:

```typescript
import {
  validatePdfA,
  stripProhibitedFeatures,
  flattenTransparency,
  detectTransparency,
  enforcePdfA,
} from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

async function convertToPdfA(
  inputPath: string,
  outputPath: string,
  level: '1b' | '2b' | '3b' = '2b',
) {
  let bytes = new Uint8Array(await readFile(inputPath));

  // Step 1: Strip prohibited features (JavaScript, Launch, etc.)
  const stripResult = stripProhibitedFeatures(bytes);
  if (stripResult.modified) {
    console.log('Stripped prohibited features:', stripResult.stripped);
    bytes = stripResult.bytes;
  }

  // Step 2: Flatten transparency (PDF/A-1 only)
  if (level === '1b') {
    const transparency = detectTransparency(bytes);
    if (transparency.hasTransparency) {
      console.log(`Flattening ${transparency.findings.length} transparency features`);
      bytes = flattenTransparency(bytes);
    }
  }

  // Step 3: Enforce PDF/A compliance (adds XMP metadata + file ID)
  bytes = await enforcePdfA(bytes, level);

  // Step 4: Validate the result
  const result = validatePdfA(bytes, level);
  if (result.valid) {
    console.log(`Successfully converted to PDF/A-${level}`);
  } else {
    console.warn('Remaining issues:');
    for (const issue of result.issues) {
      console.warn(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }

  await writeFile(outputPath, bytes);
}

await convertToPdfA('input.pdf', 'output-pdfa.pdf', '2b');
```

---

## Best Practices

1. **Always validate after enforcement** — `enforcePdfA` may not fix all issues (e.g., unembedded fonts require re-embedding the font program).

2. **Use PDF/A-2b for new documents** — It is the most practical level for modern workflows, allowing transparency and JPEG2000 while maintaining archival guarantees.

3. **Use PDF/A-3b for e-invoicing** — Required for ZUGFeRD/Factur-X. The embedded XML must use the `Alternative` relationship.

4. **Embed all fonts** — The single most common PDF/A failure is missing font embeddings. The standard 14 fonts (Helvetica, Times, Courier, etc.) are **not** exempt.

5. **Strip before enforcing** — Call `stripProhibitedFeatures` before `enforcePdfA` to remove JavaScript and other prohibited actions that would cause enforcement to throw.

6. **Set document language** — PDF/A recommends a `/Lang` entry in the catalog. This is especially important for accessibility (level `a`) but good practice for all levels.

7. **Include output intents** — Use `buildOutputIntent` with the built-in sRGB profile when your document uses `DeviceRGB` colors.

8. **Validate XMP separately** — Use `validateXmpMetadata` for detailed XMP diagnostics when the main validation reports XMP issues.

9. **Test with veraPDF** — For authoritative ISO 19005 conformance testing, validate your output with [veraPDF](https://verapdf.org/), the industry-standard open-source PDF/A validator.

10. **Check profile capabilities first** — Use `getProfile(level)` to programmatically check what a level allows before choosing your target.

---

## API Reference

| Function | Description |
|---|---|
| `validatePdfA(bytes, level)` | Validate PDF bytes against a conformance level |
| `enforcePdfA(bytes, level)` | Enforce compliance (adds XMP metadata + file ID) |
| `detectTransparency(bytes)` | Detect transparency features in PDF bytes |
| `flattenTransparency(bytes)` | Remove transparency for PDF/A-1 compliance |
| `stripProhibitedFeatures(bytes, options?)` | Remove prohibited actions and features |
| `validateXmpMetadata(bytes, level)` | Validate XMP metadata against PDF/A requirements |
| `extractXmpMetadata(bytes)` | Extract raw XMP XML string from PDF bytes |
| `generatePdfAXmp(options)` | Generate a PDF/A XMP metadata string |
| `generatePdfAXmpBytes(options)` | Generate PDF/A XMP metadata as `Uint8Array` |
| `getProfile(level)` | Get the profile definition for a PDF/A level |
| `getSupportedLevels()` | List all supported PDF/A levels |
| `isValidLevel(level)` | Check if a level string is valid |
| `buildOutputIntent(registry, options?)` | Create an output intent with ICC profile |
| `createAssociatedFile(registry, options)` | Create a PDF/A-3 associated file entry |
| `buildAfArray(refs)` | Build an `/AF` array from file spec references |
| `getToUnicodeCmap(fontName)` | Get a ToUnicode CMap for a standard font |

### Key Types

| Type | Description |
|---|---|
| `PdfALevel` | `'1a' \| '1b' \| '2a' \| '2b' \| '2u' \| '3a' \| '3b' \| '3u'` |
| `PdfAValidationResult` | `{ valid, level, issues }` |
| `PdfAIssue` | `{ code, message, severity }` |
| `PdfAProfile` | Profile definition with feature flags |
| `TransparencyInfo` | Transparency detection result |
| `TransparencyFinding` | Individual transparency finding |
| `StripResult` | `{ bytes, stripped, modified }` |
| `StripOptions` | Per-feature strip toggles |
| `XmpValidationResult` | `{ valid, issues, metadata }` |
| `ParsedXmpMetadata` | Structured XMP fields |
| `PdfAXmpOptions` | XMP generation options |
| `OutputIntentOptions` | Output intent configuration |
| `AssociatedFileOptions` | Associated file configuration |
| `AssociatedFileResult` | `{ fileSpecRef, streamRef }` |
| `AFRelationship` | `'Source' \| 'Data' \| 'Alternative' \| ...` |
