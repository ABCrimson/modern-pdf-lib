# Accessibility & Tagged PDF

This guide covers creating accessible PDF documents with `modern-pdf-lib`, including document structure, language metadata, and best practices for PDF/UA compliance.

## Overview

An accessible PDF contains structural information (tags) that enables assistive technologies like screen readers to interpret the document correctly. The key components are:

- **Document language** — declares the natural language of the content
- **Document title** — shown in the viewer's title bar
- **Metadata** — author, subject, keywords for discoverability
- **Logical reading order** — content structure that matches visual layout
- **Text extraction** — searchable, selectable, and readable text

## Setting Document Language

Always declare the document language. This tells screen readers which voice/pronunciation rules to use:

```ts
import { createPdf } from 'modern-pdf-lib';

const pdf = createPdf();

// Set the document language (BCP 47 / ISO 639)
pdf.setLanguage('en-US');
```

Common language codes:

| Code | Language |
|---|---|
| `en` | English |
| `en-US` | English (United States) |
| `fr` | French |
| `de` | German |
| `ja` | Japanese |
| `zh-CN` | Chinese (Simplified) |
| `ar` | Arabic |

## Document Title and Metadata

Set a meaningful title and metadata for assistive technology and search:

```ts
pdf.setTitle('Quarterly Revenue Report — Q4 2025', {
  showInWindowTitleBar: true,
});

pdf.setAuthor('Jane Smith');
pdf.setSubject('Financial report for Q4 2025');
pdf.setKeywords(['revenue', 'quarterly', 'finance']);
pdf.setProducer('modern-pdf-lib');
pdf.setCreator('Report Generator v3');
```

The `showInWindowTitleBar: true` option sets `/ViewerPreferences /DisplayDocTitle true`, which tells PDF viewers to show the document title instead of the filename.

## Text Best Practices

### Use Embedded Fonts

Always embed fonts rather than relying on standard fonts when producing accessible documents. Embedded fonts contain glyph-to-Unicode mappings (ToUnicode CMaps) that enable accurate text extraction:

```ts
import { readFile } from 'node:fs/promises';

const fontBytes = await readFile('NotoSans-Regular.ttf');
const font = pdf.embedFont(fontBytes);

const page = pdf.addPage();
page.drawText('Accessible text with proper Unicode mappings', {
  x: 50, y: 700, size: 12, font,
});
```

### Text Extraction Verification

Verify that text can be extracted correctly from your generated PDFs:

```ts
import { loadPdf, extractText } from 'modern-pdf-lib';

const doc = loadPdf(pdfBytes);
const text = extractText(doc);
console.log(text);
// Should output the exact text content, not garbled characters
```

### Multilingual Content

For documents with multiple languages, embed the appropriate fonts for each script:

```ts
const latinFont = pdf.embedFont(await readFile('NotoSans-Regular.ttf'));
const cjkFont = pdf.embedFont(await readFile('NotoSansCJK-Regular.ttf'));
const arabicFont = pdf.embedFont(await readFile('NotoSansArabic-Regular.ttf'));

page.drawText('English text', { x: 50, y: 700, font: latinFont, size: 12 });
page.drawText('中文内容',     { x: 50, y: 670, font: cjkFont,   size: 12 });
page.drawText('نص عربي',      { x: 50, y: 640, font: arabicFont, size: 12 });
```

## Color and Contrast

Ensure sufficient color contrast for visual accessibility:

```ts
import { rgb } from 'modern-pdf-lib';

// Good: dark text on light background (high contrast)
page.drawText('Readable text', {
  x: 50, y: 500, size: 14,
  color: rgb(0.1, 0.1, 0.1),  // near-black
});

// Avoid: light text on light background (low contrast)
// page.drawText('Hard to read', { color: rgb(0.8, 0.8, 0.8) });
```

The WCAG 2.1 guideline requires a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text (18pt+ or 14pt+ bold).

## Images and Alt Text

When embedding images, consider providing text descriptions nearby for accessibility. While PDF annotation-level alt text requires tagged PDF structure, you can include descriptive text on the page:

```ts
const image = await pdf.embedImage(await readFile('chart.png'));
page.drawImage(image, { x: 50, y: 300, width: 400, height: 250 });

// Add a descriptive caption
page.drawText('Figure 1: Revenue growth by quarter, showing 15% YoY increase', {
  x: 50, y: 285, size: 9,
  color: rgb(0.3, 0.3, 0.3),
});
```

## PDF/UA Compliance Checklist

PDF/UA (ISO 14289) defines requirements for universally accessible PDFs. While full PDF/UA support requires tagged PDF structure trees (a planned future feature), you can follow these practices today:

| Requirement | Status | How |
|---|---|---|
| Document language set | Supported | `pdf.setLanguage('en')` |
| Document title set | Supported | `pdf.setTitle('...', { showInWindowTitleBar: true })` |
| Fonts embedded with Unicode mappings | Supported | `pdf.embedFont(ttfBytes)` |
| Text is extractable | Supported | Verified via `extractText()` |
| Sufficient color contrast | Manual | Use `rgb()` with WCAG ratios |
| Structure tags (headings, paragraphs, lists) | Planned | Not yet implemented |
| Alt text on images | Planned | Requires structure tree |
| Reading order tags | Planned | Requires structure tree |
| Table headers marked | Planned | Requires structure tree |

## XMP Metadata

The library writes XMP metadata for PDF/A and accessibility tool compatibility:

```ts
// XMP metadata is automatically generated from the document properties
// when you set title, author, subject, etc.
pdf.setTitle('My Document');
pdf.setAuthor('Author Name');

// The resulting PDF will contain both the Info dictionary and
// an XMP metadata stream with dc:title, dc:creator, etc.
```

## Future: Tagged PDF

Full tagged PDF support (structure trees, heading levels, list items, table headers, alt text) is on the roadmap. When available, it will enable:

- Automatic heading hierarchy (`<H1>`, `<H2>`, etc.)
- List structure (`<L>`, `<LI>`, `<Lbl>`, `<LBody>`)
- Table structure (`<Table>`, `<TR>`, `<TH>`, `<TD>`)
- Figure alt text (`<Figure>` with `/Alt` attribute)
- Reading order specification via the structure tree
