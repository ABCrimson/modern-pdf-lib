# Cookbook

Complete, runnable recipes for common PDF tasks with `modern-pdf-lib`. Each example includes all necessary imports and produces a valid PDF.

## 1. Creating an Invoice

Generate a full invoice with a header, line items table, and totals on an A4 page.

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';
import { writeFile } from 'node:fs/promises';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

const pageWidth = page.getWidth();   // 595.28
const pageHeight = page.getHeight(); // 841.89

const fontRegular = StandardFonts.Helvetica;
const fontBold = StandardFonts.HelveticaBold;
const black = rgb(0, 0, 0);
const gray = rgb(0.4, 0.4, 0.4);
const lightGray = rgb(0.92, 0.92, 0.92);
const darkBlue = rgb(0.1, 0.15, 0.4);

// --- Header ---
page.drawText('INVOICE', {
  x: 50, y: pageHeight - 60, size: 28, font: fontBold, color: darkBlue,
});
page.drawText('Acme Corp', {
  x: 50, y: pageHeight - 85, size: 12, font: fontRegular, color: gray,
});
page.drawText('Invoice #: INV-2026-0042', {
  x: 380, y: pageHeight - 60, size: 11, font: fontRegular, color: black,
});
page.drawText('Date: 2026-02-27', {
  x: 380, y: pageHeight - 76, size: 11, font: fontRegular, color: black,
});

// --- Bill To ---
const billToY = pageHeight - 130;
page.drawText('Bill To:', {
  x: 50, y: billToY, size: 11, font: fontBold, color: black,
});
page.drawText('Jane Smith', {
  x: 50, y: billToY - 16, size: 11, font: fontRegular, color: black,
});
page.drawText('456 Oak Avenue, Springfield, IL 62701', {
  x: 50, y: billToY - 32, size: 11, font: fontRegular, color: gray,
});

// --- Line items table ---
const tableTop = pageHeight - 210;
const colX = [50, 280, 370, 460];
const colHeaders = ['Description', 'Qty', 'Unit Price', 'Amount'];
const rowHeight = 24;

// Table header background
page.drawRectangle({
  x: 50, y: tableTop - 4, width: pageWidth - 100, height: rowHeight,
  color: darkBlue,
});

// Table header text
for (let i = 0; i < colHeaders.length; i++) {
  page.drawText(colHeaders[i], {
    x: colX[i] + 4, y: tableTop + 2, size: 10, font: fontBold, color: rgb(1, 1, 1),
  });
}

// Line items data
const items = [
  { desc: 'Website Redesign',        qty: 1,  price: 3500.00 },
  { desc: 'SEO Optimization',        qty: 1,  price: 1200.00 },
  { desc: 'Content Writing (pages)', qty: 12, price: 150.00  },
  { desc: 'Hosting (annual)',         qty: 1,  price: 480.00  },
];

let currentY = tableTop - rowHeight;
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const amount = item.qty * item.price;
  const rowY = currentY - i * rowHeight;

  // Alternate row background
  if (i % 2 === 0) {
    page.drawRectangle({
      x: 50, y: rowY - 4, width: pageWidth - 100, height: rowHeight,
      color: lightGray,
    });
  }

  page.drawText(item.desc, {
    x: colX[0] + 4, y: rowY + 2, size: 10, font: fontRegular, color: black,
  });
  page.drawText(String(item.qty), {
    x: colX[1] + 4, y: rowY + 2, size: 10, font: fontRegular, color: black,
  });
  page.drawText(`$${item.price.toFixed(2)}`, {
    x: colX[2] + 4, y: rowY + 2, size: 10, font: fontRegular, color: black,
  });
  page.drawText(`$${amount.toFixed(2)}`, {
    x: colX[3] + 4, y: rowY + 2, size: 10, font: fontRegular, color: black,
  });
}

// Bottom line under table
const tableBottom = currentY - items.length * rowHeight;
page.drawLine({
  start: { x: 50, y: tableBottom },
  end: { x: pageWidth - 50, y: tableBottom },
  color: gray, thickness: 1,
});

// --- Totals ---
const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
const tax = subtotal * 0.08;
const total = subtotal + tax;

const totalsX = 380;
const totalsLabelX = 380;
const totalsValueX = 460;
let totalsY = tableBottom - 24;

page.drawText('Subtotal:', {
  x: totalsLabelX, y: totalsY, size: 11, font: fontRegular, color: black,
});
page.drawText(`$${subtotal.toFixed(2)}`, {
  x: totalsValueX, y: totalsY, size: 11, font: fontRegular, color: black,
});

totalsY -= 18;
page.drawText('Tax (8%):', {
  x: totalsLabelX, y: totalsY, size: 11, font: fontRegular, color: black,
});
page.drawText(`$${tax.toFixed(2)}`, {
  x: totalsValueX, y: totalsY, size: 11, font: fontRegular, color: black,
});

totalsY -= 22;
page.drawLine({
  start: { x: totalsLabelX, y: totalsY + 16 },
  end: { x: pageWidth - 50, y: totalsY + 16 },
  color: black, thickness: 1,
});
page.drawText('Total:', {
  x: totalsLabelX, y: totalsY, size: 13, font: fontBold, color: darkBlue,
});
page.drawText(`$${total.toFixed(2)}`, {
  x: totalsValueX, y: totalsY, size: 13, font: fontBold, color: darkBlue,
});

// --- Footer ---
page.drawText('Thank you for your business!', {
  x: 50, y: 60, size: 10, font: fontRegular, color: gray,
});

const bytes = await doc.save();
await writeFile('invoice.pdf', bytes);
console.log('Invoice saved to invoice.pdf');
```

## 2. Adding Watermarks

Load an existing PDF and apply a diagonal "CONFIDENTIAL" watermark to every page.

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

const existingBytes = new Uint8Array(await readFile('document.pdf'));
const doc = await loadPdf(existingBytes);

doc.addWatermark({
  text: 'CONFIDENTIAL',
  fontSize: 72,
  color: { r: 0.9, g: 0.1, b: 0.1 },
  opacity: 0.15,
  rotation: 45,
  position: 'center',
});

const bytes = await doc.save();
await writeFile('watermarked.pdf', bytes);
console.log('Watermarked PDF saved');
```

> [!TIP]
> The `position` option accepts `'center'`, `'top'`, or `'bottom'`. Use `'center'` for a single large diagonal mark, or apply multiple watermarks with different positions for more coverage.

## 3. Extracting Text with Positions

Parse a PDF and extract text items with their x/y coordinates, then group them into lines.

```ts
import { loadPdf, extractTextWithPositions, parseContentStream } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('document.pdf'));
const doc = await loadPdf(bytes);
const pages = doc.getPages();

for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
  const page = pages[pageIdx];
  const contentStream = page.getContentStreamData();

  // Parse the content stream into operators
  const operators = parseContentStream(contentStream);

  // Extract text items with position information
  const items = extractTextWithPositions(operators);

  if (items.length === 0) {
    console.log(`Page ${pageIdx + 1}: (no text found)`);
    continue;
  }

  // Group items into lines by sorting by y descending (top of page first),
  // then by x ascending (left to right)
  const LINE_THRESHOLD = 3; // points — items within this vertical distance are on the same line
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: typeof items[] = [];
  let currentLine: typeof items = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentLine[0];
    const curr = sorted[i];

    if (Math.abs(prev.y - curr.y) <= LINE_THRESHOLD) {
      currentLine.push(curr);
    } else {
      lines.push(currentLine);
      currentLine = [curr];
    }
  }
  lines.push(currentLine);

  console.log(`\n--- Page ${pageIdx + 1} ---`);
  for (const line of lines) {
    const lineText = line.map((item) => item.text).join(' ');
    const y = line[0].y.toFixed(1);
    console.log(`  [y=${y}] ${lineText}`);
  }
}
```

> [!NOTE]
> Each `TextItem` contains `text`, `x`, `y`, `width`, and `height` properties. The `y` value is in PDF coordinates (bottom-left origin), so higher `y` values are closer to the top of the page.

## 4. Filling and Flattening Forms

Load a PDF form, fill in text fields, then flatten the form so the values become static content.

```ts
import { loadPdf } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('application-form.pdf'));
const doc = await loadPdf(bytes);
const form = doc.getForm();

// Discover all field names and types
const fields = form.getFields();
console.log('Form fields:');
for (const field of fields) {
  console.log(`  "${field.getName()}" — ${field.constructor.name}`);
}

// Fill text fields
const firstNameField = form.getTextField('applicant.firstName');
firstNameField.setText('Jane');

const lastNameField = form.getTextField('applicant.lastName');
lastNameField.setText('Smith');

const emailField = form.getTextField('applicant.email');
emailField.setText('jane.smith@example.com');

const dateField = form.getTextField('applicationDate');
dateField.setText('2026-02-27');

// Flatten the form — values become permanent, non-editable content
form.flatten();

const savedBytes = await doc.save();
await writeFile('filled-application.pdf', savedBytes);
console.log('Form filled and flattened');
```

> [!WARNING]
> Flattening is irreversible. Once flattened, the form fields are removed and the values are burned into the page content. Always keep a copy of the original PDF if you might need to re-fill it later.

## 5. Merging Multiple PDFs

Combine several PDF files into a single document using `mergePdfs`, or selectively copy pages with `copyPages`.

**Approach A — Merge entire documents:**

```ts
import { mergePdfs } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

const pdf1 = new Uint8Array(await readFile('report-part1.pdf'));
const pdf2 = new Uint8Array(await readFile('report-part2.pdf'));
const pdf3 = new Uint8Array(await readFile('appendix.pdf'));

const mergedDoc = await mergePdfs([pdf1, pdf2, pdf3]);

const bytes = await mergedDoc.save();
await writeFile('full-report.pdf', bytes);
console.log('Merged 3 PDFs into full-report.pdf');
```

**Approach B — Copy specific pages:**

```ts
import { loadPdf, createPdf, copyPages, PageSizes } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

const sourceBytes = new Uint8Array(await readFile('large-document.pdf'));
const sourceDoc = await loadPdf(sourceBytes);

const targetDoc = createPdf();

// Copy only pages 1, 3, and 5 (zero-indexed)
const copiedPages = await copyPages(sourceDoc, targetDoc, [0, 2, 4]);

for (const page of copiedPages) {
  targetDoc.addPage(page);
}

const bytes = await targetDoc.save();
await writeFile('selected-pages.pdf', bytes);
console.log('Copied 3 selected pages into selected-pages.pdf');
```

> [!TIP]
> `mergePdfs` is the simplest approach when you want all pages from all documents. Use `copyPages` when you need to pick specific pages or interleave pages from different sources.

## 6. Adding Page Numbers

Loop over all pages and draw centered page numbers at the bottom of each page.

```ts
import { loadPdf, StandardFonts, rgb } from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

const bytes = new Uint8Array(await readFile('document.pdf'));
const doc = await loadPdf(bytes);
const font = await doc.embedFont(
  new Uint8Array(await readFile('fonts/Inter-Regular.ttf'))
);

const pages = doc.getPages();
const totalPages = pages.length;
const fontSize = 10;
const bottomMargin = 30;

for (let i = 0; i < totalPages; i++) {
  const page = pages[i];
  const pageWidth = page.getWidth();

  const text = `Page ${i + 1} of ${totalPages}`;
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  // Center the text horizontally
  const x = (pageWidth - textWidth) / 2;

  page.drawText(text, {
    x,
    y: bottomMargin,
    size: fontSize,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
}

const savedBytes = await doc.save();
await writeFile('numbered.pdf', savedBytes);
console.log(`Added page numbers to ${totalPages} pages`);
```

> [!NOTE]
> If you do not have a custom font file available, you can use a standard font instead. Replace the `embedFont` call with `StandardFonts.Helvetica` and use the standard font in `drawText`. Note that `widthOfTextAtSize` is only available on embedded `FontRef` objects; for standard fonts, you can estimate the width as `text.length * fontSize * 0.5` for Helvetica.

## 7. Creating Accessible PDFs

Build a tagged PDF with a structure tree, marked content for headings and paragraphs, and alt text for images.

```ts
import {
  createPdf,
  PageSizes,
  StandardFonts,
  rgb,
  beginMarkedContentSequence,
  endMarkedContent,
} from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

const doc = createPdf();

// Set document language and title for accessibility
doc.setTitle('Accessible Report', { showInWindowTitleBar: true });
doc.setLanguage('en-US');

const page = doc.addPage(PageSizes.A4);
const pageHeight = page.getHeight();

// Create the structure tree for tagged PDF
const tree = doc.createStructureTree();

// --- Heading ---
const h1Element = tree.addElement(null, 'H1', { altText: 'Report Title' });
const h1Mcid = tree.assignMcid(h1Element, 0); // page index 0

// Wrap heading content in marked content operators
page.pushOperators(beginMarkedContentSequence('H1', h1Mcid));
page.drawText('Quarterly Sales Report', {
  x: 50,
  y: pageHeight - 60,
  size: 24,
  font: StandardFonts.HelveticaBold,
  color: rgb(0, 0, 0),
});
page.pushOperators(endMarkedContent());

// --- First paragraph ---
const p1Element = tree.addElement(null, 'P');
const p1Mcid = tree.assignMcid(p1Element, 0);

page.pushOperators(beginMarkedContentSequence('P', p1Mcid));
page.drawText('This report covers Q4 2025 sales data across all regions.', {
  x: 50,
  y: pageHeight - 100,
  size: 12,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});
page.pushOperators(endMarkedContent());

// --- Second paragraph ---
const p2Element = tree.addElement(null, 'P');
const p2Mcid = tree.assignMcid(p2Element, 0);

page.pushOperators(beginMarkedContentSequence('P', p2Mcid));
page.drawText('Total revenue increased by 15% compared to the previous quarter.', {
  x: 50,
  y: pageHeight - 125,
  size: 12,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});
page.pushOperators(endMarkedContent());

// --- Figure with alt text ---
const figureElement = tree.addElement(null, 'Figure', {
  altText: 'Bar chart showing quarterly revenue by region: North $2.4M, South $1.8M, East $3.1M, West $2.7M',
});
const figureMcid = tree.assignMcid(figureElement, 0);

page.pushOperators(beginMarkedContentSequence('Figure', figureMcid));

// Draw a placeholder chart rectangle
page.drawRectangle({
  x: 50,
  y: pageHeight - 350,
  width: 400,
  height: 200,
  color: rgb(0.95, 0.95, 0.98),
  borderColor: rgb(0.7, 0.7, 0.7),
  borderWidth: 1,
});
page.drawText('[Chart: Revenue by Region]', {
  x: 160,
  y: pageHeight - 260,
  size: 14,
  font: StandardFonts.HelveticaOblique,
  color: rgb(0.5, 0.5, 0.5),
});

// If you have a real image, add alt text to it:
// const image = doc.embedPng(imageBytes);
// page.drawImage(image, { x: 50, y: pageHeight - 350, width: 400, height: 200 });
// page.addAltText(image, 'Bar chart showing quarterly revenue by region');

page.pushOperators(endMarkedContent());

const bytes = await doc.save();
await writeFile('accessible-report.pdf', bytes);
console.log('Accessible tagged PDF saved');
```

> [!TIP]
> For PDF/UA compliance, every image must have alt text, every heading must be properly nested (H1 before H2), and the document must have a language set. Use `checkAccessibility(doc)` to validate your tagged PDF structure.

## 8. Encrypting with Permissions

Encrypt a PDF with user and owner passwords, allowing printing but preventing copying.

```ts
import { createPdf, PageSizes, StandardFonts, rgb } from 'modern-pdf-lib';
import { writeFile } from 'node:fs/promises';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawText('This document is encrypted and copy-protected.', {
  x: 50,
  y: page.getHeight() - 60,
  size: 16,
  font: StandardFonts.Helvetica,
  color: rgb(0, 0, 0),
});

page.drawText('You can print this PDF, but you cannot copy text from it.', {
  x: 50,
  y: page.getHeight() - 90,
  size: 12,
  font: StandardFonts.Helvetica,
  color: rgb(0.3, 0.3, 0.3),
});

// Encrypt the document
await doc.encrypt({
  userPassword: 'viewerpass',
  ownerPassword: 'adminpass',
  permissions: {
    printing: true,
    copying: false,
    modifying: false,
    annotating: false,
    fillingForms: true,
    contentAccessibility: true,
    documentAssembly: false,
  },
  algorithm: 'aes-256',
});

const bytes = await doc.save();
await writeFile('encrypted.pdf', bytes);
console.log('Encrypted PDF saved');
```

> [!NOTE]
> The `userPassword` is required to open the document. The `ownerPassword` grants full access, including the ability to change permissions. If you set `userPassword` to an empty string `''`, the document opens without a password prompt but still enforces the specified permissions.

Available permission flags:

| Flag | Description |
|---|---|
| `printing` | `true` = full quality, `'lowResolution'` = low-res only, `false` = no printing |
| `modifying` | Allow content modifications |
| `copying` | Allow text/graphics extraction |
| `annotating` | Allow adding/modifying annotations |
| `fillingForms` | Allow filling interactive form fields |
| `contentAccessibility` | Allow text extraction for accessibility tools |
| `documentAssembly` | Allow inserting/deleting/rotating pages |

## 9. Digital Signatures

Sign a PDF using the three-step `prepareForSigning` / `computeSignatureHash` / `embedSignature` workflow. This allows you to use any external signing mechanism (HSM, cloud KMS, smart card).

```ts
import {
  loadPdf,
  prepareForSigning,
  computeSignatureHash,
  embedSignature,
  buildPkcs7Signature,
} from 'modern-pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';

// Step 0: Load and save the PDF to get final bytes
const originalBytes = new Uint8Array(await readFile('contract.pdf'));
const doc = await loadPdf(originalBytes);
const pdfBytes = await doc.save();

// Step 1: Prepare the PDF with a signature placeholder
// This inserts a /Sig dictionary with a byte-range and a zeroed-out
// /Contents placeholder for the signature.
const { preparedPdf, byteRange } = prepareForSigning(
  pdfBytes,
  'Signature1',  // signature field name
  8192,          // placeholder size in bytes (8 KB for PKCS#7)
);

// Step 2: Hash the PDF content (everything except the placeholder)
const hashDigest = await computeSignatureHash(
  preparedPdf,
  byteRange.byteRange,
  'SHA-256',
);

// Step 3: Sign the hash with your private key
// This example uses buildPkcs7Signature for a self-contained PKCS#7 envelope.
// In production, you would send the hash to your HSM/KMS and get back
// a DER-encoded PKCS#7/CMS signature.
const privateKeyPem = await readFile('certs/private-key.pem', 'utf-8');
const certificatePem = await readFile('certs/certificate.pem', 'utf-8');

const signatureBytes = await buildPkcs7Signature(hashDigest, {
  privateKey: privateKeyPem,
  certificate: certificatePem,
  hashAlgorithm: 'SHA-256',
});

// Step 4: Embed the signature into the prepared PDF
const signedPdf = embedSignature(preparedPdf, signatureBytes, byteRange);

await writeFile('signed-contract.pdf', signedPdf);
console.log('Signed PDF saved to signed-contract.pdf');
```

> [!WARNING]
> The `buildPkcs7Signature` helper is suitable for demonstration and testing. For production use with hardware security modules (HSMs), cloud KMS providers, or smart cards, you would compute the hash with `computeSignatureHash`, send it to your signing service, and then call `embedSignature` with the returned DER-encoded PKCS#7 bytes.

### Verifying Signatures

You can verify existing signatures on a PDF:

```ts
import { loadPdf, verifySignatures } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const pdfBytes = new Uint8Array(await readFile('signed-contract.pdf'));
const results = await verifySignatures(pdfBytes);

for (const result of results) {
  console.log(`Field: ${result.fieldName}`);
  console.log(`  Integrity: ${result.integrityValid ? 'VALID' : 'INVALID'}`);
  console.log(`  Signer:    ${result.signerName ?? 'unknown'}`);
  console.log(`  Date:      ${result.signingDate ?? 'unknown'}`);
}
```
