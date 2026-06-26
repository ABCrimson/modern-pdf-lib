---
title: Builder Pattern
---

# Builder Pattern

modern-pdf-lib provides a fluent `PdfDocumentBuilder` that wraps the standard `PdfDocument` API with method chaining. Instead of writing imperative step-by-step code, the builder lets you declare your document structure in a single expression.

---

## Quick Start

```ts
import { PdfDocumentBuilder, PageSizes, rgb } from 'modern-pdf-lib';

const bytes = await PdfDocumentBuilder.create()
  .setTitle('Quarterly Report')
  .setAuthor('Finance Team')
  .setLanguage('en-US')
  .addPage(PageSizes.A4, (page) => {
    page.drawText('Q1 2026 Results', { x: 50, y: 750, size: 28 });
    page.drawRectangle({
      x: 50, y: 700, width: 200, height: 2,
      color: rgb(0.2, 0.4, 0.8),
    });
  })
  .addPage(PageSizes.A4, (page) => {
    page.drawText('Revenue Overview', { x: 50, y: 750, size: 18 });
  })
  .save();
```

The entire document -- metadata, pages, and content -- is defined in a single chained expression. The `save()` call at the end serializes everything to a `Uint8Array`.

---

## Creating a Builder

### New Document

```ts
import { PdfDocumentBuilder } from 'modern-pdf-lib';

const builder = PdfDocumentBuilder.create();
```

### From an Existing PDF

```ts
import { PdfDocumentBuilder } from 'modern-pdf-lib';
import { readFile } from 'node:fs/promises';

const existingPdf = new Uint8Array(await readFile('template.pdf'));
const builder = await PdfDocumentBuilder.load(existingPdf);
```

The `load()` factory accepts `Uint8Array`, `ArrayBuffer`, or a Base64-encoded string. You can also pass `LoadPdfOptions` for encrypted PDFs:

```ts
const builder = await PdfDocumentBuilder.load(encryptedPdf, {
  password: 'secret',
});
```

---

## Metadata Methods

All metadata methods return `this` for chaining:

```ts
const builder = PdfDocumentBuilder.create()
  .setTitle('Annual Report', { showInWindowTitleBar: true })
  .setAuthor('Acme Corp')
  .setSubject('Financial summary for 2026')
  .setKeywords(['finance', 'annual', 'report'])
  .setProducer('modern-pdf-lib')
  .setCreator('Report Generator v3')
  .setCreationDate(new Date('2026-01-15'))
  .setModificationDate(new Date())
  .setLanguage('en');
```

| Method | Parameter | Description |
|---|---|---|
| `setTitle()` | `string`, options? | Document title (optional `showInWindowTitleBar`) |
| `setAuthor()` | `string` | Author name |
| `setSubject()` | `string` | Document subject |
| `setKeywords()` | `string[]` | Search keywords |
| `setProducer()` | `string` | Producer application |
| `setCreator()` | `string` | Creator application |
| `setCreationDate()` | `Date` | Creation timestamp |
| `setModificationDate()` | `Date` | Modification timestamp |
| `setLanguage()` | `string` | BCP 47 language tag |

---

## Adding Pages

### Single Page with Content

The `addPage()` method accepts an optional page size and a setup callback:

```ts
builder.addPage(PageSizes.Letter, (page) => {
  page.drawText('Hello from the builder!', { x: 50, y: 700, size: 20 });
});
```

When no size is provided, the page defaults to A4:

```ts
builder.addPage(undefined, (page) => {
  page.drawText('Default A4 page', { x: 50, y: 750, size: 14 });
});
```

### Multiple Pages

Use `addPages()` to add a batch of pages with the same size:

```ts
builder.addPages(5, PageSizes.A4, (page, index) => {
  page.drawText(`Page ${index + 1}`, { x: 50, y: 750, size: 14 });
});
```

---

## Embedding Fonts and Images

Font and image embedding are async operations. The builder handles this with a callback pattern that defers execution until `save()` is called:

### Fonts

```ts
import { readFile } from 'node:fs/promises';

const fontData = new Uint8Array(await readFile('fonts/Inter.ttf'));

const bytes = await PdfDocumentBuilder.create()
  .withFont(fontData, (font, builder) => {
    builder.addPage(PageSizes.A4, (page) => {
      page.drawText('Custom font!', { x: 50, y: 700, size: 24, font });
    });
  })
  .save();
```

### Images

```ts
const logoData = new Uint8Array(await readFile('logo.png'));

const bytes = await PdfDocumentBuilder.create()
  .withImage(logoData, (image, builder) => {
    builder.addPage(PageSizes.A4, (page) => {
      page.drawImage(image, { x: 50, y: 600, width: 200, height: 100 });
    });
  })
  .save();
```

::: tip Deferred Execution
`withFont()` and `withImage()` queue their work internally. The actual embedding happens when `save()` is called, in the order the methods were chained. This keeps the builder chain synchronous while supporting async operations.
:::

---

## Encryption

```ts
const bytes = await PdfDocumentBuilder.create()
  .setTitle('Confidential Report')
  .addPage(PageSizes.A4, (page) => {
    page.drawText('Secret content', { x: 50, y: 700, size: 14 });
  })
  .encrypt({
    userPassword: 'reader-pass',
    ownerPassword: 'admin-pass',
  })
  .save();
```

---

## Page Labels and Bookmarks

```ts
const bytes = await PdfDocumentBuilder.create()
  .setPageLabels([
    { startPage: 0, style: 'roman-lower', prefix: '' },
    { startPage: 3, style: 'decimal', prefix: '' },
  ])
  .addPage(PageSizes.A4, (page) => {
    page.drawText('Cover', { x: 50, y: 700, size: 24 });
  })
  .addBookmark({ title: 'Cover Page', pageIndex: 0 })
  .addBookmark({ title: 'Chapter 1', pageIndex: 1 })
  .save();
```

---

## Escape Hatch

When the builder API does not expose a feature you need, use `getDocument()` to access the underlying `PdfDocument`:

```ts
const builder = PdfDocumentBuilder.create();
builder.addPage(PageSizes.A4);

const doc = builder.getDocument();
const page = doc.getPage(0);
page.drawCircle({ x: 300, y: 400, radius: 50, color: rgb(1, 0, 0) });

const bytes = await builder.save();
```

::: warning
Deferred operations (from `withFont`, `withImage`, `encrypt`) are NOT executed when calling `getDocument()`. They only run when `save()` is called. If you use the escape hatch before save, fonts and images from `withFont`/`withImage` callbacks will not yet be available on the document.
:::

---

## Builder vs Direct API

| Aspect | `PdfDocumentBuilder` | `PdfDocument` |
|---|---|---|
| Style | Declarative, fluent chaining | Imperative, step-by-step |
| Async handling | Deferred via callbacks | Explicit `await` |
| Best for | Simple documents, templates | Complex workflows, page manipulation |
| Feature coverage | Core operations | Full API surface |
| Escape hatch | `getDocument()` | N/A |

**Use the builder when:**
- You are creating a document from scratch with a known structure
- You prefer declarative, chainable code
- Your document setup fits in a single expression

**Use the direct API when:**
- You need to copy pages between documents
- You are working with forms, annotations, or signatures
- You need fine-grained control over object references
- Your workflow involves conditional logic that does not fit a chain

---

## API Reference

| Export | Description |
|---|---|
| `PdfDocumentBuilder` | The fluent builder class |
| `PdfDocumentBuilder.create()` | Create a new empty document builder |
| `PdfDocumentBuilder.load()` | Load an existing PDF into a builder |
| `.setTitle()` / `.setAuthor()` / ... | Chainable metadata setters |
| `.addPage()` / `.addPages()` | Add pages with optional setup callbacks |
| `.withFont()` / `.withImage()` | Deferred font/image embedding |
| `.encrypt()` | Configure document encryption |
| `.setPageLabels()` | Set page label ranges |
| `.addBookmark()` | Add an outline bookmark |
| `.save()` | Serialize to `Uint8Array` (executes deferred ops) |
| `.getDocument()` | Escape hatch to the underlying `PdfDocument` |
