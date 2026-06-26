---
title: Headers & Footers
---

# Headers & Footers

modern-pdf-lib includes a template-driven header and footer engine for automatic page numbering, running titles, dates, and separator lines. Apply headers and footers to an entire document in a single call, or control individual pages for advanced layouts.

## Quick Start

```ts
import { createPdf, PageSizes, applyHeaderFooter, rgb } from 'modern-pdf-lib';

const doc = createPdf();
doc.addPage(PageSizes.A4);
doc.addPage(PageSizes.A4);
doc.addPage(PageSizes.A4);

applyHeaderFooter(doc, {
  header: [
    { text: 'Annual Report 2026', position: 'left', fontSize: 10 },
    { text: 'Page {page} of {pages}', position: 'right', fontSize: 10 },
  ],
  footer: [
    { text: '{date}', position: 'center', fontSize: 9, color: rgb(0.5, 0.5, 0.5) },
  ],
});

const bytes = await doc.save();
```

## Template Variables

Header and footer text supports template variables that are replaced at render time:

| Variable | Output | Example |
|---|---|---|
| `{page}` | Current page number (Arabic) | `1`, `2`, `3` |
| `{pages}` | Total page count | `12` |
| `{date}` | Current date (formatted per `dateFormat`) | `2026-03-08` |
| `{title}` | Document title from metadata | `Annual Report` |
| `{page:roman}` | Page number as lowercase Roman numeral | `i`, `ii`, `iii` |
| `{page:alpha}` | Page number as lowercase letter | `a`, `b`, `c` |

```ts
// Roman numeral front matter, Arabic body pages
applyHeaderFooter(doc, {
  footer: [
    { text: '{page:roman}', position: 'center' },
  ],
  pageRange: { start: 1, end: 4 }, // Front matter only
});

applyHeaderFooter(doc, {
  footer: [
    { text: '{page}', position: 'center' },
  ],
  pageRange: { start: 5 },
});
```

## Multi-Section Headers

Each header or footer is an array of `HeaderFooterContent` items. Use the `position` property to place content on the left, center, or right:

```ts
applyHeaderFooter(doc, {
  header: [
    { text: '{title}', position: 'left', fontSize: 11 },
    { text: 'Confidential', position: 'center', fontSize: 9, color: rgb(0.8, 0, 0) },
    { text: 'Page {page}', position: 'right', fontSize: 11 },
  ],
});
```

All three positions render on the same line, aligned to the left margin, page center, and right margin respectively.

## HeaderFooterContent Options

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | required | Static text or template string |
| `position` | `'left' \| 'center' \| 'right'` | required | Horizontal alignment |
| `font` | `FontRef \| string` | default font | Font to use |
| `fontSize` | `number` | `10` | Font size in points |
| `color` | `Color` | black | Text colour |
| `bold` | `boolean` | `false` | Bold text |
| `italic` | `boolean` | `false` | Italic text |

## HeaderFooterOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `header` | `HeaderFooterContent[]` | none | Header content items |
| `footer` | `HeaderFooterContent[]` | none | Footer content items |
| `margins` | `object` | `{ top: 36, bottom: 36, left: 50, right: 50 }` | Edge margins in points |
| `skipFirstPage` | `boolean` | `false` | Skip the first page (e.g. title page) |
| `pageRange` | `{ start?: number; end?: number }` | all pages | 1-based page range |
| `separatorLine` | `object` | none | Line between header/footer and content |
| `dateFormat` | `string` | `'YYYY-MM-DD'` | Date format for `{date}` variable |

## Separator Lines

Add a visual separator between the header/footer and the page content:

```ts
applyHeaderFooter(doc, {
  header: [
    { text: 'Chapter 1: Introduction', position: 'left', fontSize: 12 },
  ],
  separatorLine: {
    width: 0.5,                     // Line thickness in points
    color: rgb(0.7, 0.7, 0.7),     // Light gray
    dashPattern: [3, 2],            // 3pt dash, 2pt gap (omit for solid)
  },
});
```

The separator line is drawn below the header text (or above the footer text), spanning the full content width between the left and right margins.

## Skipping Pages

### Skip Title Page

```ts
applyHeaderFooter(doc, {
  skipFirstPage: true,
  footer: [
    { text: 'Page {page} of {pages}', position: 'center' },
  ],
});
```

::: tip
When `skipFirstPage` is `true`, the first page is skipped but `{page}` still counts from 1. If you want the second physical page to show "Page 1", apply headers manually with `applyHeaderFooterToPage()` and pass a custom page number.
:::

### Page Ranges

Apply different headers to different sections of the document:

```ts
// Front matter: Roman numerals, no header
applyHeaderFooter(doc, {
  footer: [{ text: '{page:roman}', position: 'center' }],
  pageRange: { start: 1, end: 3 },
});

// Body: Arabic numbers with chapter title
applyHeaderFooter(doc, {
  header: [
    { text: 'User Guide', position: 'left' },
    { text: 'Page {page}', position: 'right' },
  ],
  pageRange: { start: 4, end: 20 },
});

// Appendices: Alphabetic numbering
applyHeaderFooter(doc, {
  footer: [{ text: 'Appendix {page:alpha}', position: 'center' }],
  pageRange: { start: 21 },
});
```

## Per-Page Control

For full control, use `applyHeaderFooterToPage()` to target a single page:

```ts
import { applyHeaderFooterToPage } from 'modern-pdf-lib';

const pages = doc.getPages();

applyHeaderFooterToPage(pages[0]!, {
  header: [{ text: 'Cover Page', position: 'center', fontSize: 14 }],
}, 1, pages.length, 'My Document');
```

| Parameter | Type | Description |
|---|---|---|
| `page` | `PdfPage` | The page to draw on |
| `options` | `HeaderFooterOptions` | Header/footer configuration |
| `pageNumber` | `number` | 1-based page number for template variables |
| `totalPages` | `number` | Total page count for `{pages}` |
| `title` | `string` | Optional title for `{title}` |

## Date Formatting

The `{date}` variable is formatted using the `dateFormat` option. The format string supports these tokens:

| Token | Output | Example |
|---|---|---|
| `YYYY` | 4-digit year | `2026` |
| `MM` | 2-digit month | `03` |
| `DD` | 2-digit day | `08` |
| `HH` | 2-digit hours (24h) | `14` |
| `mm` | 2-digit minutes | `30` |
| `ss` | 2-digit seconds | `45` |

```ts
applyHeaderFooter(doc, {
  dateFormat: 'DD/MM/YYYY',
  footer: [
    { text: 'Printed: {date}', position: 'right' },
    // => 'Printed: 08/03/2026'
  ],
});
```

The `formatDate()` utility is also exported for standalone use:

```ts
import { formatDate } from 'modern-pdf-lib';

formatDate(new Date(), 'YYYY-MM-DD');          // '2026-03-08'
formatDate(new Date(), 'DD/MM/YYYY HH:mm');   // '08/03/2026 14:30'
```

## Page Number Utilities

The `toRoman()` and `toAlpha()` converters are exported for use outside of headers/footers:

```ts
import { toRoman, toAlpha } from 'modern-pdf-lib';

toRoman(1);    // 'i'
toRoman(4);    // 'iv'
toRoman(14);   // 'xiv'
toRoman(2026); // 'mmxxvi'

toAlpha(1);    // 'a'
toAlpha(26);   // 'z'
toAlpha(27);   // 'aa'
toAlpha(52);   // 'az'
```

## Complete Example

```ts
import { createPdf, PageSizes, applyHeaderFooter, rgb, grayscale } from 'modern-pdf-lib';

const doc = createPdf();
doc.setTitle('Quarterly Report');
for (let i = 0; i < 12; i++) {
  doc.addPage(PageSizes.A4);
}

applyHeaderFooter(doc, {
  skipFirstPage: true,
  header: [
    { text: '{title}', position: 'left', fontSize: 10, color: grayscale(0.3) },
    { text: 'Q1 2026', position: 'right', fontSize: 10, color: grayscale(0.3) },
  ],
  footer: [
    { text: 'Confidential', position: 'left', fontSize: 8, color: rgb(0.7, 0, 0) },
    { text: 'Page {page} of {pages}', position: 'center', fontSize: 9 },
    { text: '{date}', position: 'right', fontSize: 8, color: grayscale(0.5) },
  ],
  separatorLine: { width: 0.5, color: grayscale(0.8) },
  margins: { top: 30, bottom: 30, left: 50, right: 50 },
  dateFormat: 'YYYY-MM-DD',
});

const bytes = await doc.save();
```

## Best Practices

1. **Use `applyHeaderFooter()` for whole-document headers** -- it handles page iteration, title extraction, and page counting automatically.

2. **Use `skipFirstPage` for title pages** -- most professional documents omit headers and footers on the cover page.

3. **Keep font sizes small** -- headers and footers should not compete with body content. Sizes of 8-10pt work well.

4. **Use grayscale or muted colours** -- subtle header/footer styling avoids visual clutter. Reserve bold colours for warnings or branding.

5. **Combine page ranges for multi-section documents** -- call `applyHeaderFooter()` multiple times with different `pageRange` values to create distinct front-matter, body, and appendix styles.

6. **Test Roman numerals for large numbers** -- `toRoman()` handles values up to the thousands, but very large numbers produce long strings. Consider using Arabic numerals beyond page 50 or so.
