[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDocumentBuilder

# Class: PdfDocumentBuilder

Defined in: [src/core/pdfDocumentBuilder.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L65)

Fluent builder for creating PDF documents with a chainable API.

Methods that don't require async return `this` for chaining.
Methods that require async operations (font/image embedding) use
a callback pattern so the builder chain can continue synchronously.

Use [getDocument](#getdocument) as an escape hatch to access the underlying
[PdfDocument](PdfDocument.md) directly when the builder API is insufficient.

## Example

```ts
const bytes = await PdfDocumentBuilder.create()
  .setTitle('Report')
  .setAuthor('Acme Corp')
  .addPage(PageSizes.A4, page => {
    page.drawText('Hello, World!', { x: 50, y: 750, size: 24 });
  })
  .save();
```

## Methods

### addBookmark()

```ts
addBookmark(options): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:304](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L304)

Add a bookmark (outline entry) to the document.

#### Parameters

##### options

[`AddBookmarkOptions`](../interfaces/AddBookmarkOptions.md)

Bookmark configuration (title, page, nesting, style).

#### Returns

`this`

The builder (for continued chaining).  The
                [BookmarkRef](../interfaces/BookmarkRef.md) is not returned — use
                [getDocument](#getdocument) if you need nested bookmarks.

***

### addPage()

```ts
addPage(size?, setup?): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:189](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L189)

Add a page to the document.

#### Parameters

##### size?

[`PageSize`](../type-aliases/PageSize.md)

Page size as a `[width, height]` tuple, `{ width, height }`
              object, or one of the [PageSizes](../variables/PageSizes.md) constants.
              Defaults to A4 when omitted.

##### setup?

(`page`) =&gt; `void`

Optional callback invoked with the newly created page.
              Use this to draw content on the page inline.

#### Returns

`this`

***

### addPages()

```ts
addPages(
   count, 
   size?, 
   setup?): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L203)

Add multiple pages with the same size and optional per-page setup.

#### Parameters

##### count

`number`

Number of pages to add.

##### size?

[`PageSize`](../type-aliases/PageSize.md)

Page size (defaults to A4).

##### setup?

(`page`, `index`) =&gt; `void`

Optional callback invoked for each page with its
              zero-based index within this batch.

#### Returns

`this`

***

### encrypt()

```ts
encrypt(options): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L275)

Configure encryption for this document.

The encryption is applied when [save](#save) serializes the document.

#### Parameters

##### options

[`EncryptOptions`](../interfaces/EncryptOptions.md)

Encryption options (passwords, algorithm, permissions).

#### Returns

`this`

***

### getDocument()

```ts
getDocument(): PdfDocument;
```

Defined in: [src/core/pdfDocumentBuilder.ts:344](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L344)

Escape hatch — return the underlying [PdfDocument](PdfDocument.md).

Use this when you need access to APIs not exposed by the builder
(e.g. `copyPages`, `getPage`, `embedPage`, advanced outline
manipulation, etc.).

**Note:** Deferred operations (from [withFont](#withfont), [withImage](#withimage),
[encrypt](#encrypt)) are NOT executed when calling this method.  They
are only resolved when [save](#save) is called.

#### Returns

[`PdfDocument`](PdfDocument.md)

***

### save()

```ts
save(options?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/pdfDocumentBuilder.ts:322](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L322)

Serialize the document to a `Uint8Array`.

Executes all deferred async operations (font/image embedding,
encryption setup) before serializing.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The complete PDF file as bytes.

***

### setAuthor()

```ts
setAuthor(author): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:125](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L125)

Set the document author.

#### Parameters

##### author

`string`

#### Returns

`this`

***

### setCreationDate()

```ts
setCreationDate(date): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L155)

Set the document creation date.

#### Parameters

##### date

`Date`

#### Returns

`this`

***

### setCreator()

```ts
setCreator(creator): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:149](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L149)

Set the creator application name.

#### Parameters

##### creator

`string`

#### Returns

`this`

***

### setKeywords()

```ts
setKeywords(keywords): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:137](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L137)

Set the document keywords.

#### Parameters

##### keywords

`string`[]

#### Returns

`this`

***

### setLanguage()

```ts
setLanguage(lang): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L171)

Set the document's natural language (BCP 47 tag).

#### Parameters

##### lang

`string`

BCP 47 language tag (e.g. `"en"`, `"en-US"`, `"de-DE"`).

#### Returns

`this`

***

### setModificationDate()

```ts
setModificationDate(date): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L161)

Set the document modification date.

#### Parameters

##### date

`Date`

#### Returns

`this`

***

### setPageLabels()

```ts
setPageLabels(labels): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:291](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L291)

Set page label ranges for the document.

Page labels control how page numbers are displayed in the PDF
viewer's navigation controls and thumbnail panel.

#### Parameters

##### labels

[`PageLabelRange`](../interfaces/PageLabelRange.md)[]

An array of label range definitions, sorted by
               `startPage` in ascending order.

#### Returns

`this`

***

### setProducer()

```ts
setProducer(producer): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L143)

Set the producer string.

#### Parameters

##### producer

`string`

#### Returns

`this`

***

### setSubject()

```ts
setSubject(subject): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:131](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L131)

Set the document subject.

#### Parameters

##### subject

`string`

#### Returns

`this`

***

### setTitle()

```ts
setTitle(title, options?): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L119)

Set the document title.

#### Parameters

##### title

`string`

The title string.

##### options?

[`SetTitleOptions`](../interfaces/SetTitleOptions.md)

Optional display options (e.g. show in window title bar).

#### Returns

`this`

***

### withFont()

```ts
withFont(fontNameOrData, callback): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:231](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L231)

Embed a font and use it in a callback.

Because font embedding is async (for TrueType fonts), this method
defers the operation and executes it when [save](#save) is called.
The callback receives the [FontRef](../interfaces/FontRef.md) and the builder so that
further pages can reference the font.

#### Parameters

##### fontNameOrData

`string` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Standard font name string or raw TTF/OTF bytes.

##### callback

(`font`, `builder`) =&gt; `void`

Invoked with the embedded font reference and
                       the builder instance for continued chaining.

#### Returns

`this`

***

### withImage()

```ts
withImage(imageData, callback): this;
```

Defined in: [src/core/pdfDocumentBuilder.ts:253](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L253)

Embed an image and use it in a callback.

Because image embedding may be async (for JPEG, WebP, TIFF), this
method defers the operation and executes it when [save](#save) is
called.  The callback receives the [ImageRef](../interfaces/ImageRef.md) and the builder.

#### Parameters

##### imageData

`Uint8Array`

Raw image bytes (PNG, JPEG, WebP, or TIFF).

##### callback

(`image`, `builder`) =&gt; `void`

Invoked with the embedded image reference and
                  the builder instance.

#### Returns

`this`

***

### create()

```ts
static create(): PdfDocumentBuilder;
```

Defined in: [src/core/pdfDocumentBuilder.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L88)

Create a new, empty builder wrapping a fresh [PdfDocument](PdfDocument.md).

#### Returns

`PdfDocumentBuilder`

A new builder instance.

***

### load()

```ts
static load(data, options?): Promise<PdfDocumentBuilder>;
```

Defined in: [src/core/pdfDocumentBuilder.ts:101](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfDocumentBuilder.ts#L101)

Load an existing PDF into the builder.

#### Parameters

##### data

`string` \| `ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
                Base64-encoded string.

##### options?

[`LoadPdfOptions`](../interfaces/LoadPdfOptions.md)

Optional loading options (e.g. password).

#### Returns

`Promise`\&lt;`PdfDocumentBuilder`\&gt;

A promise that resolves to the builder wrapping the
                loaded document.
