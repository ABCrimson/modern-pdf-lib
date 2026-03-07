# API Reference

This page organizes every public export by what you're trying to do. Each section includes quick examples and links to the full TypeDoc reference.

---

## Document Lifecycle

Create, load, save, and configure PDF documents.

### Create a New PDF

```ts
import { createPdf } from 'modern-pdf-lib';

const doc = createPdf();
```

| Function | Description |
|:---|:---|
| [`createPdf()`](functions/createPdf.md) | Create a blank PDF document |
| [`loadPdf(bytes, options?)`](functions/loadPdf.md) | Load an existing PDF from `Uint8Array` |

### Save a PDF

```ts
const bytes = await doc.save();                  // Uint8Array
const stream = doc.saveAsStream();               // ReadableStream
const blob = await doc.saveAsBlob();             // Blob (browsers)
```

| Method / Function | Description |
|:---|:---|
| [`doc.save(options?)`](classes/PdfDocument.md) | Serialize to `Uint8Array` |
| [`doc.saveAsStream()`](classes/PdfDocument.md) | Serialize as a `ReadableStream` |
| [`doc.saveAsBlob()`](classes/PdfDocument.md) | Serialize as a `Blob` (browser) |
| [`saveIncremental(doc)`](functions/saveIncremental.md) | Append-only incremental save |
| [`serializePdf(doc)`](functions/serializePdf.md) | Low-level serialization |

### Document Metadata

```ts
doc.setTitle('Invoice #1042', { showInWindowTitleBar: true });
doc.setAuthor('Jane Doe');
doc.setLanguage('en');
doc.setCreationDate(new Date());
```

| Interface | Description |
|:---|:---|
| [`PdfDocument`](classes/PdfDocument.md) | Full document class — metadata, pages, fonts, images |
| [`PdfSaveOptions`](interfaces/PdfSaveOptions.md) | Compression, encryption, permissions |
| [`SetTitleOptions`](interfaces/SetTitleOptions.md) | Window title bar display |
| [`LoadPdfOptions`](interfaces/LoadPdfOptions.md) | Password, parse speed, validation |
| [`DocumentMetadata`](interfaces/DocumentMetadata.md) | Title, author, subject, keywords |
| [`ViewerPreferences`](interfaces/ViewerPreferences.md) | Page layout, toolbar visibility |

---

## Pages

Add, remove, reorder, and manipulate pages.

### Basic Page Operations

```ts
import { PageSizes } from 'modern-pdf-lib';

const page = doc.addPage(PageSizes.A4);      // 595 x 842 pt
const page2 = doc.addPage([600, 400]);       // Custom size
const pages = doc.getPages();                // readonly PdfPage[]
```

| Function | Description |
|:---|:---|
| [`insertPage(doc, index, page)`](functions/insertPage.md) | Insert at specific position |
| [`removePage(doc, index)`](functions/removePage.md) | Remove a single page |
| [`removePages(doc, indices)`](functions/removePages.md) | Remove multiple pages |
| [`movePage(doc, from, to)`](functions/movePage.md) | Reorder a page |
| [`reversePages(doc)`](functions/reversePages.md) | Reverse page order |
| [`rotatePage(doc, index, angle)`](functions/rotatePage.md) | Rotate a page |
| [`rotateAllPages(doc, angle)`](functions/rotateAllPages.md) | Rotate all pages |
| [`resizePage(doc, index, size)`](functions/resizePage.md) | Change page dimensions |
| [`cropPage(doc, index, box)`](functions/cropPage.md) | Set crop box |

| Variable | Description |
|:---|:---|
| [`PageSizes`](variables/PageSizes.md) | A0–A10, B0–B10, C, RA, SRA, Letter, Legal, Tabloid, Folio |

| Class | Description |
|:---|:---|
| [`PdfPage`](classes/PdfPage.md) | Page drawing surface — text, images, shapes, SVG |

---

## Drawing

All drawing methods live on `PdfPage`.

### Text

```ts
const font = doc.embedStandardFont('Helvetica');

page.drawText('Hello World', {
  x: 50, y: 700,
  size: 24,
  font,
  color: rgb(0.13, 0.13, 0.13),
  maxWidth: 400,
});
```

| Interface | Description |
|:---|:---|
| [`DrawTextOptions`](interfaces/DrawTextOptions.md) | Font, size, color, rotation, opacity, maxWidth, lineHeight |

### Images

```ts
const png = doc.embedPng(pngBytes);                // sync
const jpg = await doc.embedJpeg(jpgBytes);         // async
const img = await doc.embedImage(anyImageBytes);   // auto-detect

page.drawImage(img, { x: 50, y: 400, width: 200, height: 150 });
```

| Interface | Description |
|:---|:---|
| [`DrawImageOptions`](interfaces/DrawImageOptions.md) | Position, size, rotation, opacity, blend mode |
| [`ImageRef`](interfaces/ImageRef.md) | Embedded image reference (width, height) |

### Shapes

```ts
page.drawRectangle({ x: 50, y: 300, width: 100, height: 50, color: rgb(0, 0.5, 1) });
page.drawCircle({ x: 200, y: 325, radius: 25, borderColor: rgb(0, 0, 0) });
page.drawLine({ start: { x: 50, y: 280 }, end: { x: 300, y: 280 } });
page.drawSvgPath('M 0 0 L 100 0 L 50 80 Z', { x: 300, y: 300, color: rgb(1, 0, 0) });
```

| Interface | Description |
|:---|:---|
| [`DrawRectangleOptions`](interfaces/DrawRectangleOptions.md) | Position, size, color, border, rotation |
| [`DrawSquareOptions`](interfaces/DrawSquareOptions.md) | Square shorthand |
| [`DrawCircleOptions`](interfaces/DrawCircleOptions.md) | Center, radius, color, border |
| [`DrawEllipseOptions`](interfaces/DrawEllipseOptions.md) | Ellipse with x/y radius |
| [`DrawLineOptions`](interfaces/DrawLineOptions.md) | Start, end, thickness, color, dash |
| [`DrawSvgPathOptions`](interfaces/DrawSvgPathOptions.md) | SVG path data, position, color |
| [`DrawPageOptions`](interfaces/DrawPageOptions.md) | Draw an embedded page |

---

## Fonts

```ts
// Standard 14 fonts (no embedding needed)
const helvetica = doc.embedStandardFont('Helvetica');

// Custom TrueType / OpenType
const inter = await doc.embedFont(fontBytes, { subset: true });

console.log(inter.widthOfTextAtSize('Hello', 12));  // number
console.log(inter.heightAtSize(12));                 // number
```

| Interface | Description |
|:---|:---|
| [`FontRef`](interfaces/FontRef.md) | Embedded font — `widthOfTextAtSize()`, `heightAtSize()`, `sizeAtHeight()` |
| [`EmbedFontOptions`](interfaces/EmbedFontOptions.md) | Subset, custom name, features |
| [`FontMetrics`](interfaces/FontMetrics.md) | Ascent, descent, line gap |
| [`StandardFontName`](type-aliases/StandardFontName.md) | `'Helvetica'`, `'TimesRoman'`, `'Courier'`, etc. |
| [`StandardFonts`](variables/StandardFonts.md) | Enum of all 14 standard font names |

---

## Colors

```ts
import { rgb, cmyk, grayscale } from 'modern-pdf-lib';

const red = rgb(1, 0, 0);
const blue = rgb(0, 0, 1);
const gray = grayscale(0.5);
const cyan = cmyk(1, 0, 0, 0);
```

| Function | Description |
|:---|:---|
| [`rgb(r, g, b)`](functions/rgb.md) | RGB color (0–1 range) |
| [`cmyk(c, m, y, k)`](functions/cmyk.md) | CMYK color (0–1 range) |
| [`grayscale(g)`](functions/grayscale.md) | Grayscale (0 = black, 1 = white) |
| [`colorToComponents(color)`](functions/colorToComponents.md) | Extract numeric components |
| [`componentsToColor(type, values)`](functions/componentsToColor.md) | Build color from components |

| Type | Description |
|:---|:---|
| [`Color`](type-aliases/Color.md) | `RgbColor \| CmykColor \| GrayscaleColor` |
| [`RgbColor`](interfaces/RgbColor.md) | `{ type: 'RGB', red, green, blue }` |
| [`CmykColor`](interfaces/CmykColor.md) | `{ type: 'CMYK', cyan, magenta, yellow, key }` |
| [`GrayscaleColor`](interfaces/GrayscaleColor.md) | `{ type: 'Grayscale', gray }` |

---

## Forms

Fill, create, and flatten AcroForm fields.

```ts
const form = doc.getForm();

form.getTextField('name').setText('Jane Doe');
form.getCheckbox('agree').check();
form.getDropdown('country').select('Canada');
form.getRadioGroup('size').select('Medium');

form.flatten();  // Burn values into page content
```

| Class | Description |
|:---|:---|
| [`PdfForm`](classes/PdfForm.md) | Form access — `getTextField()`, `getCheckbox()`, `getDropdown()`, etc. |
| [`PdfTextField`](classes/PdfTextField.md) | Text input — `setText()`, `getText()`, `setMaxLength()` |
| [`PdfCheckboxField`](classes/PdfCheckboxField.md) | Checkbox — `check()`, `uncheck()`, `isChecked()` |
| [`PdfDropdownField`](classes/PdfDropdownField.md) | Dropdown select — `select()`, `getOptions()`, `addOptions()` |
| [`PdfRadioGroup`](classes/PdfRadioGroup.md) | Radio buttons — `select()`, `getOptions()` |
| [`PdfListboxField`](classes/PdfListboxField.md) | Multi-select list — `select()`, `getSelected()` |
| [`PdfButtonField`](classes/PdfButtonField.md) | Push button — `setImage()` |
| [`PdfSignatureField`](classes/PdfSignatureField.md) | Signature field |
| [`PdfField`](classes/PdfField.md) | Base class — `getName()`, `isReadOnly()`, `addToPage()` |

---

## Merge, Split, Copy

```ts
import { mergePdfs, splitPdf, copyPages } from 'modern-pdf-lib';

const merged = await mergePdfs([pdf1Bytes, pdf2Bytes]);
const [part1, part2] = await splitPdf(pdfBytes, [
  { start: 0, end: 4 },
  { start: 5, end: 9 },
]);
```

| Function | Description |
|:---|:---|
| [`mergePdfs(sources)`](functions/mergePdfs.md) | Merge multiple PDFs into one |
| [`splitPdf(source, ranges)`](functions/splitPdf.md) | Split a PDF by page ranges |
| [`copyPages(source, dest, indices)`](functions/copyPages.md) | Copy specific pages between documents |

---

## Tables

Render tables with spanning, pagination, presets, and styled text.

```ts
import { createPdf, PageSizes, professionalPreset, applyPreset, rgb } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

page.drawTable(applyPreset(professionalPreset(), {
  x: 50, y: 750, width: 495,
  headerRows: 1,
  rows: [
    { cells: ['Product', 'Qty', 'Price'] },
    { cells: ['Widget A', '10', '$5.00'] },
    { cells: [{ content: 'Total', colSpan: 2, align: 'right' }, '$5.00'] },
  ],
  columns: [{ flex: 2 }, { width: 60 }, { width: 80, align: 'right' }],
}));
```

| Function | Description |
|:---|:---|
| [`renderTable(options)`](functions/renderTable.md) | Render a single-page table (returns operator string) |
| [`renderMultiPageTable(options, bottomMargin?)`](functions/renderMultiPageTable.md) | Auto-paginate with header repetition |
| [`applyPreset(preset, options)`](functions/applyPreset.md) | Merge a preset with custom options |
| [`applyTablePreset(name, options)`](functions/applyTablePreset.md) | Apply a preset by name |
| [`minimalPreset()`](functions/minimalPreset.md) | Clean, borderless styling |
| [`stripedPreset()`](functions/stripedPreset.md) | Alternating row colors |
| [`borderedPreset()`](functions/borderedPreset.md) | Full grid borders |
| [`professionalPreset()`](functions/professionalPreset.md) | Dark header, subtle stripes |

| Interface | Description |
|:---|:---|
| [`DrawTableOptions`](interfaces/DrawTableOptions.md) | Full table configuration |
| [`TableRow`](interfaces/TableRow.md) | Row definition with cells and optional backgroundColor |
| [`TableCell`](interfaces/TableCell.md) | Cell content, colSpan, rowSpan, align, overflow |
| [`TableColumn`](interfaces/TableColumn.md) | Width (fixed, percentage, flex, auto-fit), alignment |
| [`TextRun`](interfaces/TextRun.md) | Styled text segment (font, size, color per run) |
| [`MultiPageTableResult`](interfaces/MultiPageTableResult.md) | Pages array with operator strings |

### Text Overflow

| Function | Description |
|:---|:---|
| [`applyOverflow(text, mode, width, fontSize)`](functions/applyOverflow.md) | Apply overflow strategy |
| [`wrapText(text, width, fontSize)`](functions/wrapText.md) | Word-wrap text |
| [`truncateText(text, width, fontSize)`](functions/truncateText.md) | Hard truncate |
| [`ellipsisText(text, width, fontSize)`](functions/ellipsisText.md) | Truncate with "..." |
| [`shrinkFontSize(text, width, fontSize)`](functions/shrinkFontSize.md) | Calculate reduced font size |
| [`estimateTextWidth(text, fontSize)`](functions/estimateTextWidth.md) | Approximate text width |

---

## QR Codes & Barcodes

9 formats: QR, Code 128, EAN-13, EAN-8, UPC-A, Code 39, ITF, PDF417, Data Matrix.

```ts
// QR code (built-in page method)
page.drawQrCode('https://example.com', { x: 50, y: 700, size: 120 });

// Barcodes (encode → render)
import { encodeCode128, renderStyledBarcode } from 'modern-pdf-lib';

const barcode = encodeCode128('ABC-12345');
const ops = renderStyledBarcode(barcode, { x: 50, y: 500, height: 60 });
```

### Encoding Functions

| Function | Returns | Description |
|:---|:---|:---|
| [`encodeQrCode(text, options?)`](functions/encodeQrCode.md) | `QrCodeMatrix` | QR code (ISO 18004) |
| [`encodeCode128(data, options?)`](functions/encodeCode128.md) | `number[]` | Code 128 barcode |
| [`encodeEan13(digits)`](functions/encodeEan13.md) | `number[]` | EAN-13 barcode |
| [`encodeEan8(digits)`](functions/encodeEan8.md) | `number[]` | EAN-8 barcode |
| [`encodeUpcA(digits)`](functions/encodeUpcA.md) | `number[]` | UPC-A barcode |
| [`encodeCode39(text, options?)`](functions/encodeCode39.md) | `number[]` | Code 39 barcode |
| [`encodeItf(digits, options?)`](functions/encodeItf.md) | `number[]` | Interleaved 2 of 5 |
| [`encodePdf417(data, options?)`](functions/encodePdf417.md) | `Pdf417Matrix` | PDF417 2D barcode |
| [`encodeDataMatrix(data, options?)`](functions/encodeDataMatrix.md) | `DataMatrixResult` | Data Matrix 2D |

### Rendering Functions

| Function | Description |
|:---|:---|
| [`renderStyledBarcode(modules, options)`](functions/renderStyledBarcode.md) | Render 1D barcode to PDF operators |
| [`qrCodeToOperators(matrix, options)`](functions/qrCodeToOperators.md) | Render QR matrix to PDF operators |
| [`pdf417ToOperators(matrix, options)`](functions/pdf417ToOperators.md) | Render PDF417 to PDF operators |
| [`dataMatrixToOperators(matrix, options)`](functions/dataMatrixToOperators.md) | Render Data Matrix to PDF operators |

---

## Encryption & Signatures

### Encryption

```ts
const bytes = await doc.save({
  userPassword: 'reader',
  ownerPassword: 'admin',
  permissions: { printing: true, copying: false },
});
```

| Interface | Description |
|:---|:---|
| [`EncryptOptions`](interfaces/EncryptOptions.md) | Algorithm, passwords, permissions |
| [`PdfPermissionFlags`](interfaces/PdfPermissionFlags.md) | Print, copy, modify, annotate, fill forms |

### Digital Signatures

```ts
import { signPdf, verifySignatures } from 'modern-pdf-lib';

const signed = await signPdf(pdfBytes, 'Signature1', {
  certificate: certDer,
  privateKey: keyDer,
  reason: 'Approved',
});
const results = await verifySignatures(signed);
```

| Function | Description |
|:---|:---|
| [`signPdf(bytes, fieldName, options)`](functions/signPdf.md) | Sign a PDF |
| [`verifySignatures(bytes)`](functions/verifySignatures.md) | Verify all signatures |
| [`verifySignature(bytes, info)`](functions/verifySignature.md) | Verify a single signature |
| [`findSignatures(bytes)`](functions/findSignatures.md) | List signature fields |
| [`prepareForSigning(bytes, fieldName, options)`](functions/prepareForSigning.md) | Prepare byte range |

| Interface | Description |
|:---|:---|
| [`SignOptions`](interfaces/SignOptions.md) | Certificate, key, reason, location |
| [`SignatureVerificationResult`](interfaces/SignatureVerificationResult.md) | Valid, signer, timestamp |
| [`VisibleSignatureOptions`](interfaces/VisibleSignatureOptions.md) | Visible appearance options |

---

## Text Extraction

```ts
import { loadPdf, extractText, extractTextWithPositions } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const text = extractText(doc.getPage(0));           // plain string
const items = extractTextWithPositions(              // positioned items
  doc.getPage(0).getOperators(),
  doc.getPage(0).getResources(),
);
```

| Function | Description |
|:---|:---|
| [`extractText(page)`](functions/extractText.md) | Extract plain text from a page |
| [`extractTextWithPositions(ops, resources)`](functions/extractTextWithPositions.md) | Extract text with x, y, font, size |

---

## Image Optimization

```ts
import { loadPdf, initWasm, optimizeAllImages, deduplicateImages } from 'modern-pdf-lib';

await initWasm({ jpeg: true });
const doc = await loadPdf(pdfBytes);

deduplicateImages(doc);
const report = await optimizeAllImages(doc, { quality: 75, progressive: true });
```

| Function | Description |
|:---|:---|
| [`optimizeAllImages(doc, options)`](functions/optimizeAllImages.md) | Batch optimize all images in a document |
| [`deduplicateImages(doc)`](functions/deduplicateImages.md) | Remove duplicate images (FNV-1a hash) |
| [`extractImages(doc)`](functions/extractImages.md) | List all images in a document |
| [`optimizeImage(data, options)`](functions/optimizeImage.md) | Optimize a single image |
| [`recompressImage(data, options)`](functions/recompressImage.md) | JPEG recompression |
| [`downscaleImage(data, options)`](functions/downscaleImage.md) | Reduce image dimensions |
| [`isGrayscaleImage(data)`](functions/isGrayscaleImage.md) | Detect grayscale images |
| [`convertToGrayscale(data)`](functions/convertToGrayscale.md) | Convert to grayscale |
| [`computeImageDpi(image, page)`](functions/computeImageDpi.md) | Calculate effective DPI |
| [`estimateJpegQuality(bytes)`](functions/estimateJpegQuality.md) | Estimate JPEG quality from DQT |

---

## PDF/A Compliance

```ts
import { validatePdfA, enforcePdfA } from 'modern-pdf-lib';

const issues = validatePdfA(pdfBytes, '2b');
const result = enforcePdfA(pdfBytes, '2b');
```

| Function | Description |
|:---|:---|
| [`validatePdfA(bytes, level)`](functions/validatePdfA.md) | Validate against a PDF/A level |
| [`enforcePdfA(bytes, level, options?)`](functions/enforcePdfA.md) | Auto-fix PDF/A compliance |
| [`enforcePdfAFull(bytes, level, options?)`](functions/enforcePdfAFull.md) | Full enforcement with report |
| [`getSupportedLevels()`](functions/getSupportedLevels.md) | List supported PDF/A levels |
| [`isValidLevel(level)`](functions/isValidLevel.md) | Check if a level string is valid |

---

## Accessibility

```ts
import { checkAccessibility, isAccessible } from 'modern-pdf-lib';

const issues = checkAccessibility(doc);
const ok = isAccessible(doc);
```

| Function | Description |
|:---|:---|
| [`checkAccessibility(doc)`](functions/checkAccessibility.md) | Check PDF/UA accessibility |
| [`isAccessible(doc)`](functions/isAccessible.md) | Quick pass/fail check |

| Class | Description |
|:---|:---|
| [`PdfStructureTree`](classes/PdfStructureTree.md) | Document structure tree |
| [`PdfStructureElement`](classes/PdfStructureElement.md) | Structure elements (headings, paragraphs, etc.) |

---

## Annotations

18 annotation types with appearance generation.

```ts
import { createAnnotation } from 'modern-pdf-lib';

createAnnotation(page, 'text', {
  rect: [50, 700, 80, 730],
  contents: 'Review this section',
  color: rgb(1, 1, 0),
});
```

| Class | Description |
|:---|:---|
| [`PdfTextAnnotation`](classes/PdfTextAnnotation.md) | Sticky note |
| [`PdfLinkAnnotation`](classes/PdfLinkAnnotation.md) | Hyperlink |
| [`PdfHighlightAnnotation`](classes/PdfHighlightAnnotation.md) | Text highlight |
| [`PdfUnderlineAnnotation`](classes/PdfUnderlineAnnotation.md) | Text underline |
| [`PdfStrikeOutAnnotation`](classes/PdfStrikeOutAnnotation.md) | Strikethrough |
| [`PdfSquigglyAnnotation`](classes/PdfSquigglyAnnotation.md) | Squiggly underline |
| [`PdfFreeTextAnnotation`](classes/PdfFreeTextAnnotation.md) | Free text box |
| [`PdfLineAnnotation`](classes/PdfLineAnnotation.md) | Line with endpoints |
| [`PdfSquareAnnotation`](classes/PdfSquareAnnotation.md) | Rectangle |
| [`PdfCircleAnnotation`](classes/PdfCircleAnnotation.md) | Ellipse |
| [`PdfPolygonAnnotation`](classes/PdfPolygonAnnotation.md) | Polygon |
| [`PdfPolyLineAnnotation`](classes/PdfPolyLineAnnotation.md) | Polyline |
| [`PdfInkAnnotation`](classes/PdfInkAnnotation.md) | Freehand drawing |
| [`PdfStampAnnotation`](classes/PdfStampAnnotation.md) | Stamp |
| [`PdfRedactAnnotation`](classes/PdfRedactAnnotation.md) | Redaction mark |
| [`PdfPopupAnnotation`](classes/PdfPopupAnnotation.md) | Popup |
| [`PdfCaretAnnotation`](classes/PdfCaretAnnotation.md) | Caret (insertion point) |
| [`PdfFileAttachmentAnnotation`](classes/PdfFileAttachmentAnnotation.md) | File attachment |

---

## Outlines & Bookmarks

```ts
const outline = doc.getOutline();
outline.addItem('Chapter 1', { pageIndex: 0 });
outline.addItem('Chapter 2', { pageIndex: 5 });
```

| Class | Description |
|:---|:---|
| [`PdfOutlineTree`](classes/PdfOutlineTree.md) | Document outline (bookmarks) |
| [`PdfOutlineItem`](classes/PdfOutlineItem.md) | Individual bookmark entry |

---

## Layers (OCG)

```ts
const layers = doc.getLayerManager();
const layer = layers.createLayer('Watermark');
page.drawText('DRAFT', { x: 200, y: 400, size: 72, layer });
```

| Class | Description |
|:---|:---|
| [`PdfLayerManager`](classes/PdfLayerManager.md) | Create, toggle, list layers |
| [`PdfLayer`](classes/PdfLayer.md) | Individual layer (optional content group) |

---

## Watermarks & Redaction

```ts
import { addWatermark, markForRedaction, applyRedactions } from 'modern-pdf-lib';

addWatermark(doc, { text: 'CONFIDENTIAL', opacity: 0.3 });

markForRedaction(page, { rect: [100, 700, 300, 720] });
applyRedactions(doc);
```

| Function | Description |
|:---|:---|
| [`addWatermark(doc, options)`](functions/addWatermark.md) | Add watermark to all pages |
| [`addWatermarkToPage(page, options)`](functions/addWatermarkToPage.md) | Add watermark to one page |
| [`markForRedaction(page, mark)`](functions/markForRedaction.md) | Mark area for redaction |
| [`applyRedactions(doc)`](functions/applyRedactions.md) | Apply all redaction marks |

---

## File Attachments

```ts
import { attachFile, getAttachments } from 'modern-pdf-lib';

attachFile(doc, {
  name: 'invoice.csv',
  data: csvBytes,
  mimeType: 'text/csv',
});
```

| Function | Description |
|:---|:---|
| [`attachFile(doc, options)`](functions/attachFile.md) | Attach a file to the document |
| [`getAttachments(doc)`](functions/getAttachments.md) | List embedded files |

---

## Linearization

```ts
import { linearizePdf, isLinearized } from 'modern-pdf-lib';

const optimized = linearizePdf(pdfBytes);
console.log(isLinearized(optimized));  // true
```

| Function | Description |
|:---|:---|
| [`linearizePdf(bytes, options?)`](functions/linearizePdf.md) | Optimize for fast web view |
| [`isLinearized(bytes)`](functions/isLinearized.md) | Check if PDF is linearized |

---

## WASM Acceleration

All WASM modules are optional — pure-JS fallbacks produce identical output.

```ts
import { initWasm } from 'modern-pdf-lib';

await initWasm({
  deflate: true,   // Faster compression
  png: true,       // Faster PNG decoding
  fonts: true,     // Faster font subsetting
  jpeg: true,      // JPEG encode/decode
});
```

| Function | Description |
|:---|:---|
| [`initWasm(options)`](functions/initWasm.md) | Initialize WASM modules |
| [`configureWasmLoader(config)`](functions/configureWasmLoader.md) | Custom WASM loading |
| [`clearWasmCache()`](functions/clearWasmCache.md) | Clear cached WASM modules |
| [`isWasmModuleCached(name)`](functions/isWasmModuleCached.md) | Check if a module is cached |

| Interface | Description |
|:---|:---|
| [`InitWasmOptions`](interfaces/InitWasmOptions.md) | Module selection, custom WASM sources |

---

## Text Layout

Compute text positions before drawing.

```ts
import { layoutMultilineText, layoutCombedText } from 'modern-pdf-lib';

const layout = layoutMultilineText('Long text...', {
  font: helvetica,
  fontSize: 12,
  bounds: { x: 50, y: 700, width: 400, height: 500 },
});
```

| Function | Description |
|:---|:---|
| [`layoutMultilineText(text, options)`](functions/layoutMultilineText.md) | Compute multiline text layout |
| [`layoutSinglelineText(text, options)`](functions/layoutSinglelineText.md) | Compute single-line layout |
| [`layoutCombedText(text, options)`](functions/layoutCombedText.md) | Compute combed (fixed-width cell) layout |
| [`computeFontSize(text, options)`](functions/computeFontSize.md) | Auto-size text to fit bounds |

---

## Gradients & Patterns

```ts
import { linearGradient, radialGradient, tilingPattern, rgb } from 'modern-pdf-lib';

page.drawRectangle({
  x: 50, y: 600, width: 200, height: 100,
  color: linearGradient({
    start: { x: 50, y: 600 }, end: { x: 250, y: 600 },
    stops: [{ offset: 0, color: rgb(1, 0, 0) }, { offset: 1, color: rgb(0, 0, 1) }],
  }),
});
```

| Function | Description |
|:---|:---|
| [`linearGradient(options)`](functions/linearGradient.md) | Linear gradient fill |
| [`radialGradient(options)`](functions/radialGradient.md) | Radial gradient fill |
| [`tilingPattern(options)`](functions/tilingPattern.md) | Repeating pattern fill |

---

## Browser Helpers

```ts
import { saveAsDownload, saveAsBlob, openInNewTab } from 'modern-pdf-lib/browser';

saveAsDownload(pdfBytes, 'document.pdf');
const blob = saveAsBlob(pdfBytes);
openInNewTab(pdfBytes);
```

| Class | Description |
|:---|:---|
| [`PdfWorker`](classes/PdfWorker.md) | Web Worker for off-main-thread PDF generation |

---

## Angles & Utilities

```ts
import { degrees, radians, degreesToRadians, radiansToDegrees } from 'modern-pdf-lib';

const angle = degrees(45);
const rad = degreesToRadians(45);
```

| Function | Description |
|:---|:---|
| [`degrees(value)`](functions/degrees.md) | Create a `Degrees` angle |
| [`radians(value)`](functions/radians.md) | Create a `Radians` angle |
| [`degreesToRadians(deg)`](functions/degreesToRadians.md) | Convert degrees to radians |
| [`radiansToDegrees(rad)`](functions/radiansToDegrees.md) | Convert radians to degrees |

---

## Low-Level PDF Operators

For advanced use — construct raw PDF content stream operators.

| Variable | Description |
|:---|:---|
| [`PDFOperator`](classes/PDFOperator.md) | Raw PDF operator class |

<details>
<summary><strong>60+ operator functions</strong></summary>

Graphics state: [`saveState`](functions/saveState.md), [`restoreState`](functions/restoreState.md), [`concatMatrix`](functions/concatMatrix.md), [`setLineWidthOp`](functions/setLineWidthOp.md), [`setLineCapOp`](functions/setLineCapOp.md), [`setLineJoinOp`](functions/setLineJoinOp.md), [`setDashPatternOp`](functions/setDashPatternOp.md), [`setGraphicsStateOp`](functions/setGraphicsStateOp.md)

Path construction: [`moveToOp`](functions/moveToOp.md), [`lineToOp`](functions/lineToOp.md), [`curveToOp`](functions/curveToOp.md), [`curveToInitial`](functions/curveToInitial.md), [`curveToFinal`](functions/curveToFinal.md), [`rectangleOp`](functions/rectangleOp.md), [`closePathOp`](functions/closePathOp.md)

Path painting: [`strokeOp`](functions/strokeOp.md), [`fillOp`](functions/fillOp.md), [`fillEvenOdd`](functions/fillEvenOdd.md), [`fillAndStrokeOp`](functions/fillAndStrokeOp.md), [`closeAndStroke`](functions/closeAndStroke.md), [`closeFillAndStroke`](functions/closeFillAndStroke.md), [`endPathOp`](functions/endPathOp.md)

Text: [`beginText`](functions/beginText.md), [`endText`](functions/endText.md), [`setFontOp`](functions/setFontOp.md), [`showTextOp`](functions/showTextOp.md), [`moveTextOp`](functions/moveTextOp.md), [`setTextMatrixOp`](functions/setTextMatrixOp.md), [`setTextRenderingModeOp`](functions/setTextRenderingModeOp.md), [`setCharacterSpacingOp`](functions/setCharacterSpacingOp.md), [`setWordSpacingOp`](functions/setWordSpacingOp.md), [`setLeadingOp`](functions/setLeadingOp.md), [`setTextRiseOp`](functions/setTextRiseOp.md)

Color: [`setFillColorRgb`](functions/setFillColorRgb.md), [`setStrokeColorRgb`](functions/setStrokeColorRgb.md), [`setFillColorCmyk`](functions/setFillColorCmyk.md), [`setStrokeColorCmyk`](functions/setStrokeColorCmyk.md), [`setFillColorGray`](functions/setFillColorGray.md), [`setStrokeColorGray`](functions/setStrokeColorGray.md)

Transform: [`translateOp`](functions/translateOp.md), [`scaleOp`](functions/scaleOp.md), [`rotateOp`](functions/rotateOp.md), [`skewOp`](functions/skewOp.md)

XObject: [`drawXObject`](functions/drawXObject.md), [`drawImageXObject`](functions/drawImageXObject.md)

Marked content: [`beginMarkedContent`](functions/beginMarkedContent.md), [`endMarkedContent`](functions/endMarkedContent.md), [`beginArtifact`](functions/beginArtifact.md), [`endArtifact`](functions/endArtifact.md)

</details>

---

## Enums & Constants

| Variable | Values |
|:---|:---|
| [`LineCapStyle`](variables/LineCapStyle.md) | `Butt`, `Round`, `Square` |
| [`LineJoinStyle`](variables/LineJoinStyle.md) | `Miter`, `Round`, `Bevel` |
| [`TextAlignment`](variables/TextAlignment.md) | `Left`, `Center`, `Right` |
| [`ImageAlignment`](variables/ImageAlignment.md) | `Left`, `Center`, `Right` |
| [`ParseSpeeds`](variables/ParseSpeeds.md) | `Fastest`, `Fast`, `Medium`, `Slow` |
| [`BlendMode`](variables/BlendMode.md) | `Normal`, `Multiply`, `Screen`, `Overlay`, etc. |
| [`TextRenderingMode`](variables/TextRenderingMode.md) | `Fill`, `Stroke`, `FillAndStroke`, `Invisible`, etc. |
| [`AnnotationFlags`](variables/AnnotationFlags.md) | `Invisible`, `Hidden`, `Print`, `NoZoom`, etc. |

---

## Error Classes

All errors extend `Error` with descriptive messages.

| Class | Thrown When |
|:---|:---|
| [`EncryptedPdfError`](classes/EncryptedPdfError.md) | Loading encrypted PDF without password |
| [`PdfParseError`](classes/PdfParseError.md) | Malformed PDF structure |
| [`FontNotEmbeddedError`](classes/FontNotEmbeddedError.md) | Using a font that hasn't been embedded |
| [`ForeignPageError`](classes/ForeignPageError.md) | Adding a page from a different document |
| [`NoSuchFieldError`](classes/NoSuchFieldError.md) | Accessing a non-existent form field |
| [`FieldAlreadyExistsError`](classes/FieldAlreadyExistsError.md) | Creating a field with a duplicate name |
| [`UnexpectedFieldTypeError`](classes/UnexpectedFieldTypeError.md) | Wrong field type (e.g. getTextField on a checkbox) |
| [`ExceededMaxLengthError`](classes/ExceededMaxLengthError.md) | Text exceeds field max length |
| [`CombedTextLayoutError`](classes/CombedTextLayoutError.md) | Combed text doesn't fit |
| [`RemovePageFromEmptyDocumentError`](classes/RemovePageFromEmptyDocumentError.md) | Removing from empty document |
| [`RichTextFieldReadError`](classes/RichTextFieldReadError.md) | Reading rich text field as plain text |
