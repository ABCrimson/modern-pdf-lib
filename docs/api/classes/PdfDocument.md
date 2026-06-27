[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDocument

# Class: PdfDocument

Defined in: [src/core/pdfDocument.ts:148](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L148)

The root document object.  Create via [createPdf](../functions/createPdf.md).

Manages:
- Page collection (ordered)
- Embedded resources (fonts, images)
- Document metadata (title, author, dates, …)
- Object-number allocation

## Constructors

### Constructor

```ts
new PdfDocument(registry?): PdfDocument;
```

Defined in: [src/core/pdfDocument.ts:225](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L225)

#### Parameters

##### registry?

[`PdfObjectRegistry`](PdfObjectRegistry.md)

Optional pre-populated object registry (used when
                 loading an existing PDF so parsed objects are preserved).

#### Returns

`PdfDocument`

## Accessors

### pageCount

#### Get Signature

```ts
get pageCount(): number;
```

Defined in: [src/core/pdfDocument.ts:373](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L373)

The number of pages in this document.

##### Returns

`number`

## Methods

### addJavaScript()

```ts
addJavaScript(name, script): void;
```

Defined in: [src/core/pdfDocument.ts:2159](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2159)

Add a document-level JavaScript action.

The script is registered in the catalog's `/Names` dictionary under
the `/JavaScript` name tree.  When a conforming viewer opens the
document, scripts listed here are executed automatically (in name
order).

#### Parameters

##### name

`string`

A unique name for this JavaScript entry.

##### script

`string`

The JavaScript source code.

#### Returns

`void`

#### Example

```ts
doc.addJavaScript('init', 'app.alert("Hello from PDF JavaScript!");');
```

***

### addLayer()

```ts
addLayer(name, visible?): PdfLayer;
```

Defined in: [src/core/pdfDocument.ts:2075](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2075)

Add a new optional content layer.

#### Parameters

##### name

`string`

The display name for the layer.

##### visible?

`boolean` = `true`

Whether the layer is visible by default.

#### Returns

[`PdfLayer`](PdfLayer.md)

The newly created [PdfLayer](PdfLayer.md).

***

### addOutline()

```ts
addOutline(
   title, 
   pageIndex, 
   options?): PdfOutlineItem;
```

Defined in: [src/core/pdfDocument.ts:1835](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1835)

Add a top-level outline (bookmark) entry.

Convenience method that creates or retrieves the outline tree and
adds a new item pointing to the specified page.

#### Parameters

##### title

`string`

The display title for the bookmark.

##### pageIndex

`number`

Zero-based page index to navigate to.

##### options?

[`OutlineItemOptions`](../interfaces/OutlineItemOptions.md) & `object`

Optional visual style and behaviour settings.

#### Returns

[`PdfOutlineItem`](PdfOutlineItem.md)

The newly created [PdfOutlineItem](PdfOutlineItem.md).

***

### addPage()

```ts
addPage(sizeOrPage?): PdfPage;
```

Defined in: [src/core/pdfDocument.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L293)

Add a page to the document.

When called with a [PageSize](../type-aliases/PageSize.md) (or no argument), a new blank page
is created.  When called with an existing [PdfPage](PdfPage.md) instance
(e.g. one returned by [copyPages](#copypages)), that page is inserted
directly.

#### Parameters

##### sizeOrPage?

[`PdfPage`](PdfPage.md) \| [`PageSize`](../type-aliases/PageSize.md)

A page size as `[width, height]` tuple,
                   `{ width, height }` object, one of the
                   [PageSizes](../variables/PageSizes.md) constants, or an existing
                   [PdfPage](PdfPage.md) instance.  Defaults to A4.

#### Returns

[`PdfPage`](PdfPage.md)

The [PdfPage](PdfPage.md) that was added.

***

### addSignatureField()

```ts
addSignatureField(
   pageIndex, 
   rect, 
   name): void;
```

Defined in: [src/core/pdfDocument.ts:1737](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1737)

Add a signature field to a page.

This is a placeholder method that records the intent to sign.
The actual signature creation happens in `sign()`.

#### Parameters

##### pageIndex

`number`

Zero-based page index.

##### rect

\[`number`, `number`, `number`, `number`\]

Rectangle [x1, y1, x2, y2] for the visual appearance.

##### name

`string`

The signature field name (must be unique).

#### Returns

`void`

***

### addWatermark()

```ts
addWatermark(options): void;
```

Defined in: [src/core/pdfDocument.ts:2172](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2172)

Add a text watermark to all pages in the document.

#### Parameters

##### options

[`WatermarkOptions`](../interfaces/WatermarkOptions.md)

Watermark appearance options.

#### Returns

`void`

***

### applyRedactions()

```ts
applyRedactions(): void;
```

Defined in: [src/core/pdfDocument.ts:2273](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2273)

Apply all pending redactions across all pages.

Redaction marks are added to individual pages using
`page.markForRedaction()`.  This method draws the redaction
rectangles on all pages that have pending marks.

#### Returns

`void`

***

### attachFile()

```ts
attachFile(
   name, 
   data, 
   mimeType, 
   options?): void;
```

Defined in: [src/core/pdfDocument.ts:2107](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2107)

Attach a file to this PDF document.

#### Parameters

##### name

`string`

File name.

##### data

`Uint8Array`

File data.

##### mimeType

`string`

MIME type string.

##### options?

Optional description.

###### description?

`string`

#### Returns

`void`

***

### checkAccessibility()

```ts
checkAccessibility(): AccessibilityIssue[];
```

Defined in: [src/core/pdfDocument.ts:1952](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1952)

Run accessibility checks on this document.

Validates the document against PDF/UA requirements and general
accessibility best practices.

#### Returns

[`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

An array of [AccessibilityIssue](../interfaces/AccessibilityIssue.md) objects.

***

### copy()

```ts
copy(): Promise<PdfDocument>;
```

Defined in: [src/core/pdfDocument.ts:2299](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2299)

Create an independent deep copy of this document.

The copy is produced by serializing the document to bytes and then
re-parsing those bytes.  This guarantees that the returned
`PdfDocument` is completely independent — mutations to the copy
do not affect the original, and vice versa.

#### Returns

`Promise`\&lt;`PdfDocument`\&gt;

A new `PdfDocument` that is a deep copy of this one.

#### Example

```ts
const doc = createPdf();
doc.addPage(PageSizes.A4);
const clone = await doc.copy();
clone.addPage(PageSizes.Letter); // does not affect `doc`
```

***

### copyPages()

```ts
copyPages(sourceDoc, indices): Promise<PdfPage[]>;
```

Defined in: [src/core/pdfDocument.ts:534](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L534)

Copy pages from another document into this one.

The copied pages are appended to the end of this document.
Resources (fonts, images) are deeply cloned and re-registered
in the target document's registry.

#### Parameters

##### sourceDoc

`PdfDocument`

The source document to copy pages from.

##### indices

`number`[]

Zero-based indices of pages to copy.

#### Returns

`Promise`\&lt;[`PdfPage`](PdfPage.md)[]\&gt;

The newly created pages in this document.

***

### createSoftMask()

```ts
createSoftMask(
   width, 
   height, 
   builder): SoftMaskRef;
```

Defined in: [src/core/pdfDocument.ts:2210](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2210)

Create a soft mask Form XObject that can be used with
[PdfPage.applySoftMask](PdfPage.md#applysoftmask).

The builder callback receives a [SoftMaskBuilder](../interfaces/SoftMaskBuilder.md) with methods
for generating grayscale content where white (`1`) represents fully
opaque regions and black (`0`) represents fully transparent regions.

The returned [SoftMaskRef](../interfaces/SoftMaskRef.md) is passed to
[PdfPage.applySoftMask](PdfPage.md#applysoftmask) to activate the mask for subsequent
drawing operations on that page.

#### Parameters

##### width

`number`

Width of the mask in points.

##### height

`number`

Height of the mask in points.

##### builder

(`ops`) =&gt; `void`

Callback that draws the mask content.

#### Returns

[`SoftMaskRef`](../interfaces/SoftMaskRef.md)

A reference to the soft mask Form XObject.

#### Example

```ts
const mask = doc.createSoftMask(200, 200, (b) => {
  // White background = fully opaque
  b.drawRectangle(0, 0, 200, 200, 1);
  // Black circle = fully transparent hole
  b.drawCircle(100, 100, 80, 0);
});
page.applySoftMask(mask);
page.drawRectangle({ x: 50, y: 50, width: 200, height: 200, color: rgb(1, 0, 0) });
page.clearSoftMask();
```

***

### createStructureTree()

```ts
createStructureTree(): PdfStructureTree;
```

Defined in: [src/core/pdfDocument.ts:1918](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1918)

Create a new structure tree for this document.

If a structure tree already exists, it is returned as-is.
Call this to begin making the document accessible (tagged PDF).

#### Returns

[`PdfStructureTree`](PdfStructureTree.md)

The [PdfStructureTree](PdfStructureTree.md) for this document.

***

### drawSvg()

```ts
drawSvg(
   pageIndex, 
   svgString, 
   options?): void;
```

Defined in: [src/core/pdfDocument.ts:2056](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2056)

Draw an SVG image onto a page.

#### Parameters

##### pageIndex

`number`

Zero-based page index.

##### svgString

`string`

The SVG markup string.

##### options?

[`SvgRenderOptions`](../interfaces/SvgRenderOptions.md)

Rendering options (position, size).

#### Returns

`void`

***

### embedFont()

```ts
embedFont(fontNameOrData, options?): Promise<FontRef>;
```

Defined in: [src/core/pdfDocument.ts:582](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L582)

Embed a font in the document.

Accepts either:
- A **standard font name** string (e.g. `"Helvetica"`) — embeds a
  Type 1 font reference (no font data needed).
- A **Uint8Array** of TrueType font bytes — embeds a CIDFont Type 2
  composite font with /Identity-H encoding, /FontDescriptor, /ToUnicode
  CMap, and /FontFile2 stream.

The returned [FontRef](../interfaces/FontRef.md) includes `widthOfTextAtSize()` and
`heightAtSize()` methods for text measurement.

#### Parameters

##### fontNameOrData

`string` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Base font name string or raw TTF/OTF bytes.

##### options?

[`EmbedFontOptions`](../interfaces/EmbedFontOptions.md)

Optional embedding options (subset, OpenType features).

#### Returns

`Promise`\&lt;[`FontRef`](../interfaces/FontRef.md)\&gt;

A [FontRef](../interfaces/FontRef.md) to pass to drawing methods.

***

### embedFonts()

```ts
embedFonts(items): Promise<FontRef[]>;
```

Defined in: [src/core/pdfDocument.ts:1448](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1448)

Embed multiple fonts in parallel.

Accepts an array of font descriptors — each containing either a
standard font name string or raw TTF/OTF bytes — and embeds them
concurrently using `Promise.all`. Returns an array of
[FontRef](../interfaces/FontRef.md) in the same order as the input.

#### Parameters

##### items

`object`[]

Array of font descriptors with font name/data and options.

#### Returns

`Promise`\&lt;[`FontRef`](../interfaces/FontRef.md)[]\&gt;

Array of [FontRef](../interfaces/FontRef.md) in the same order as `items`.

#### Example

```ts
const [serif, mono] = await doc.embedFonts([
  { data: serifTtfBytes },
  { data: 'Courier' },
]);
```

***

### embedImage()

```ts
embedImage(imageData): Promise<ImageRef>;
```

Defined in: [src/core/pdfDocument.ts:1375](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1375)

Embed an image, auto-detecting the format from file headers.

Inspects the first bytes to determine the image format (PNG, JPEG,
WebP, or TIFF), then delegates to the appropriate embedding method.

Supported formats:
- **PNG**: `89 50 4E 47` — embedded via [embedPng](#embedpng)
- **JPEG**: `FF D8 FF` — embedded via [embedJpeg](#embedjpeg)
- **WebP**: `52 49 46 46` + `57 45 42 50` — embedded via [embedWebP](#embedwebp)
- **TIFF LE**: `49 49 2A 00` — embedded via [embedTiff](#embedtiff)
- **TIFF BE**: `4D 4D 00 2A` — embedded via [embedTiff](#embedtiff)

#### Parameters

##### imageData

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw image file bytes (PNG, JPEG, WebP, or TIFF).

#### Returns

`Promise`\&lt;[`ImageRef`](../interfaces/ImageRef.md)\&gt;

An [ImageRef](../interfaces/ImageRef.md) to pass to `page.drawImage()`.

#### Throws

If the image format cannot be detected.

#### Example

```ts
const bytes = new Uint8Array(await readFile('photo.jpg'));
const image = await pdf.embedImage(bytes);
page.drawImage(image, { x: 50, y: 400, width: 200, height: 150 });
```

***

### embedImages()

```ts
embedImages(items): Promise<ImageRef[]>;
```

Defined in: [src/core/pdfDocument.ts:1423](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1423)

Embed multiple images in parallel.

Auto-detects each image's format (PNG, JPEG, WebP, TIFF) and embeds
them concurrently using `Promise.all`. Returns an array of
[ImageRef](../interfaces/ImageRef.md) in the same order as the input.

#### Parameters

##### items

`object`[]

Array of image descriptors with raw bytes and optional name.

#### Returns

`Promise`\&lt;[`ImageRef`](../interfaces/ImageRef.md)[]\&gt;

Array of [ImageRef](../interfaces/ImageRef.md) in the same order as `items`.

#### Example

```ts
const [logo, photo] = await doc.embedImages([
  { data: logoPngBytes },
  { data: photoJpegBytes },
]);
```

***

### embedJpeg()

```ts
embedJpeg(jpegData): Promise<ImageRef>;
```

Defined in: [src/core/pdfDocument.ts:1091](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1091)

Embed a JPEG image.

JPEG data can be embedded directly as a PDF stream with
`DCTDecode` filter — no re-encoding is needed.

#### Parameters

##### jpegData

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw JPEG file bytes as a `Uint8Array` or `ArrayBuffer`.

#### Returns

`Promise`\&lt;[`ImageRef`](../interfaces/ImageRef.md)\&gt;

An [ImageRef](../interfaces/ImageRef.md).

***

### embedPage()

```ts
embedPage(page, options?): EmbeddedPdfPage;
```

Defined in: [src/core/pdfDocument.ts:1529](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1529)

Embed a single page (from this or another document) as a Form XObject.

This is useful when you have an already-parsed PdfPage and want to
stamp it onto other pages as a form XObject.

#### Parameters

##### page

[`PdfPage`](PdfPage.md)

The PdfPage to embed.

##### options?

[`EmbedPageOptions`](../interfaces/EmbedPageOptions.md)

Optional bounding box / transformation matrix.

#### Returns

[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)

An [EmbeddedPdfPage](../interfaces/EmbeddedPdfPage.md) handle.

***

### embedPages()

```ts
embedPages(pages): EmbeddedPdfPage[];
```

Defined in: [src/core/pdfDocument.ts:1550](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1550)

Embed multiple pages as Form XObjects in batch.
Convenience wrapper around [embedPage](#embedpage).

#### Parameters

##### pages

[`PdfPage`](PdfPage.md)[]

Array of PdfPage instances to embed.

#### Returns

[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]

Array of [EmbeddedPdfPage](../interfaces/EmbeddedPdfPage.md) handles, one per input page.

***

### embedPdf()

```ts
embedPdf(
   data, 
   pageIndices?, 
options?): Promise<EmbeddedPdfPage[]>;
```

Defined in: [src/core/pdfDocument.ts:1478](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1478)

Embed pages from another PDF as Form XObjects.

Each embedded page is turned into a self-contained Form XObject that
can be painted onto any page via `page.drawPage()`.  The source PDF's
content streams are decoded and concatenated, and all referenced
resources (fonts, images, etc.) are deep-cloned into this document's
registry.

#### Parameters

##### data

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw PDF bytes (Uint8Array or ArrayBuffer).

##### pageIndices?

`number`[]

Zero-based page indices to embed.  Defaults to
                    `[0]` (first page only).

##### options?

[`EmbedPageOptions`](../interfaces/EmbedPageOptions.md)

#### Returns

`Promise`\&lt;[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]\&gt;

Array of [EmbeddedPdfPage](../interfaces/EmbeddedPdfPage.md) handles.

#### Example

```ts
const [embeddedPage] = await doc.embedPdf(existingPdfBytes, [0]);
page.drawPage(embeddedPage, { x: 50, y: 50, width: 300, height: 400 });
```

***

### embedPng()

```ts
embedPng(pngData): Promise<ImageRef>;
```

Defined in: [src/core/pdfDocument.ts:986](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L986)

Embed a PNG image.

Fully decodes the PNG (including filter reconstruction and alpha
channel separation) and creates a correct PDF image XObject.
For images with transparency, a separate SMask XObject is created
and referenced from the main image.

#### Parameters

##### pngData

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw PNG file bytes as a `Uint8Array` or `ArrayBuffer`.

#### Returns

`Promise`\&lt;[`ImageRef`](../interfaces/ImageRef.md)\&gt;

A promise resolving to an [ImageRef](../interfaces/ImageRef.md) to pass to `page.drawImage()`.

***

### ~~embedPngSync()~~

```ts
embedPngSync(pngData): ImageRef;
```

Defined in: [src/core/pdfDocument.ts:998](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L998)

Embed a PNG image synchronously.

#### Parameters

##### pngData

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw PNG file bytes as a `Uint8Array` or `ArrayBuffer`.

#### Returns

[`ImageRef`](../interfaces/ImageRef.md)

An [ImageRef](../interfaces/ImageRef.md) to pass to `page.drawImage()`.

#### Deprecated

Use [embedPng](#embedpng) (now async) for API consistency.
            Will be removed in v2.0.

***

### embedTiff()

```ts
embedTiff(tiffData, options?): ImageRef;
```

Defined in: [src/core/pdfDocument.ts:1250](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1250)

Embed a TIFF image.

Decodes the TIFF image and creates a PDF image XObject with
FlateDecode compression. For multi-page TIFFs, a specific page
can be selected via options.

#### Parameters

##### tiffData

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw TIFF file bytes as a `Uint8Array` or `ArrayBuffer`.

##### options?

Options (e.g., `{ page: 0 }` for multi-page TIFFs).

###### page?

`number`

#### Returns

[`ImageRef`](../interfaces/ImageRef.md)

An [ImageRef](../interfaces/ImageRef.md).

***

### embedWebP()

```ts
embedWebP(webpData): ImageRef;
```

Defined in: [src/core/pdfDocument.ts:1141](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1141)

Embed a WebP image.

WebP cannot be directly embedded in PDF. This method decodes the
WebP image to raw pixels (VP8/lossy, VP8L/lossless, or VP8+ALPH),
then embeds as a FlateDecode image XObject. If the WebP has
transparency, the alpha channel is embedded as a soft mask.

#### Parameters

##### webpData

`ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

Raw WebP file bytes as a `Uint8Array` or `ArrayBuffer`.

#### Returns

[`ImageRef`](../interfaces/ImageRef.md)

An [ImageRef](../interfaces/ImageRef.md).

***

### encrypt()

```ts
encrypt(options): Promise<void>;
```

Defined in: [src/core/pdfDocument.ts:1674](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1674)

Configure encryption for this document.

When encryption is set, the document will be encrypted on the next
call to `save()`.  The /Encrypt dictionary and file ID are
generated automatically.

#### Parameters

##### options

[`EncryptOptions`](../interfaces/EncryptOptions.md)

Encryption options (passwords, permissions, algorithm).

#### Returns

`Promise`\&lt;`void`\&gt;

#### Example

```ts
const doc = createPdf();
doc.addPage();
doc.encrypt({
  userPassword: 'user123',
  ownerPassword: 'owner456',
  permissions: { printing: true, copying: false },
  algorithm: 'aes-256',
});
const bytes = await doc.save();
```

***

### getAttachments()

```ts
getAttachments(): EmbeddedFile[];
```

Defined in: [src/core/pdfDocument.ts:2132](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2132)

Get all file attachments in this document.

Note: Currently returns information about files attached via
this API.  For parsing attachments from loaded PDFs, use the
lower-level `getAttachments()` function.

#### Returns

[`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

An array of embedded file metadata.

***

### getAuthor()

```ts
getAuthor(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1611](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1611)

Get the document author, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getCreationDate()

```ts
getCreationDate(): Date | undefined;
```

Defined in: [src/core/pdfDocument.ts:1636](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1636)

Get the document creation date.

#### Returns

`Date` \| `undefined`

***

### getCreator()

```ts
getCreator(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1626](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1626)

Get the creator application name, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getForm()

```ts
getForm(): PdfForm;
```

Defined in: [src/core/pdfDocument.ts:2028](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2028)

Get the interactive form (AcroForm) for this document.

If the document does not yet have a form, an empty one is created.
The form provides access to all form fields and supports fill,
flatten, and field creation operations.

#### Returns

[`PdfForm`](PdfForm.md)

The [PdfForm](PdfForm.md) for this document.

***

### getKeywords()

```ts
getKeywords(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1621](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1621)

Get the document keywords, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getLanguage()

```ts
getLanguage(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1940](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1940)

Get the document's natural language, or `undefined` if not set.

#### Returns

`string` \| `undefined`

The BCP 47 language tag, or `undefined`.

***

### getLayers()

```ts
getLayers(): PdfLayer[];
```

Defined in: [src/core/pdfDocument.ts:2085](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2085)

Get all layers in this document.

#### Returns

[`PdfLayer`](PdfLayer.md)[]

An array of [PdfLayer](PdfLayer.md) objects.

***

### getModDate()

```ts
getModDate(): Date | undefined;
```

Defined in: [src/core/pdfDocument.ts:1641](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1641)

Get the document modification date, or `undefined` if not set.

#### Returns

`Date` \| `undefined`

***

### getOutlines()

```ts
getOutlines(): PdfOutlineTree;
```

Defined in: [src/core/pdfDocument.ts:1819](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1819)

Get the outline (bookmark) tree for this document.

If no outlines have been added, returns an empty tree.

#### Returns

[`PdfOutlineTree`](PdfOutlineTree.md)

The [PdfOutlineTree](PdfOutlineTree.md) for this document.

***

### getPage()

```ts
getPage(index): PdfPage;
```

Defined in: [src/core/pdfDocument.ts:349](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L349)

Return a specific page by zero-based index.

#### Parameters

##### index

`number`

Zero-based page index.

#### Returns

[`PdfPage`](PdfPage.md)

The [PdfPage](PdfPage.md) at the given index.

#### Throws

If the index is out of range.

***

### getPageCount()

```ts
getPageCount(): number;
```

Defined in: [src/core/pdfDocument.ts:368](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L368)

Return the page count.

#### Returns

`number`

***

### getPages()

```ts
getPages(): readonly PdfPage[];
```

Defined in: [src/core/pdfDocument.ts:361](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L361)

Return all pages.

#### Returns

readonly [`PdfPage`](PdfPage.md)[]

***

### getPermissions()

```ts
getPermissions(): PdfPermissionFlags | undefined;
```

Defined in: [src/core/pdfDocument.ts:1694](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1694)

Get the permission flags for this document, if encrypted.

#### Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md) \| `undefined`

The decoded permission flags, or `undefined` if the
          document is not encrypted.

***

### getPluginManager()

```ts
getPluginManager(): PdfPluginManager;
```

Defined in: [src/core/pdfDocument.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L271)

Get the plugin manager for advanced plugin operations.

Most users should prefer `doc.use(plugin)` for registration.
The manager is exposed for cases where you need to unregister,
list, or introspect registered plugins.

#### Returns

[`PdfPluginManager`](PdfPluginManager.md)

***

### getProducer()

```ts
getProducer(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1631](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1631)

Get the producer string.

#### Returns

`string` \| `undefined`

***

### getSignatures()

```ts
getSignatures(): PdfSignatureInfo[];
```

Defined in: [src/core/pdfDocument.ts:1790](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1790)

Get information about all signatures in this document.

#### Returns

[`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Array of signature info objects.

***

### getStructureTree()

```ts
getStructureTree(): PdfStructureTree | undefined;
```

Defined in: [src/core/pdfDocument.ts:1906](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1906)

Get the structure tree for this document, or `undefined` if
no structure tree has been created.

A structure tree is required for tagged PDF / PDF/UA compliance.

#### Returns

[`PdfStructureTree`](PdfStructureTree.md) \| `undefined`

The [PdfStructureTree](PdfStructureTree.md), or `undefined`.

***

### getSubject()

```ts
getSubject(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1616](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1616)

Get the document subject, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getTitle()

```ts
getTitle(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1606](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1606)

Get the document title, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getViewerPreferences()

```ts
getViewerPreferences(): PdfViewerPreferences;
```

Defined in: [src/core/pdfDocument.ts:1974](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1974)

Get the viewer preferences for this document as a
[PdfViewerPreferences](PdfViewerPreferences.md) instance with getter/setter pairs.

If no preferences have been set, a default (empty) instance is
returned.  The instance is cached so that repeated calls return
the same object and mutations are preserved.

#### Returns

[`PdfViewerPreferences`](PdfViewerPreferences.md)

***

### getXmpMetadata()

```ts
getXmpMetadata(): string | undefined;
```

Defined in: [src/core/pdfDocument.ts:1871](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1871)

Get the raw XMP metadata string, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### hasForm()

```ts
hasForm(): boolean;
```

Defined in: [src/core/pdfDocument.ts:2015](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2015)

Check whether this document has an AcroForm (interactive form).

Returns `true` if a form has been created or if the document
was loaded from a PDF that contains an /AcroForm dictionary.

#### Returns

`boolean`

***

### insertPage()

```ts
insertPage(index, size?): PdfPage;
```

Defined in: [src/core/pdfDocument.ts:462](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L462)

Insert a new blank page at the specified position.

#### Parameters

##### index

`number`

Zero-based position (0 to pageCount inclusive).

##### size?

[`PageSize`](../type-aliases/PageSize.md)

Optional page size. Defaults to A4.

#### Returns

[`PdfPage`](PdfPage.md)

The newly created PdfPage.

***

### isEncrypted()

```ts
isEncrypted(): boolean;
```

Defined in: [src/core/pdfDocument.ts:1684](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1684)

Check whether this document has encryption configured.

Returns `true` if `encrypt()` has been called on this document,
or if the document was loaded from an encrypted PDF.

#### Returns

`boolean`

***

### movePage()

```ts
movePage(fromIndex, toIndex): void;
```

Defined in: [src/core/pdfDocument.ts:503](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L503)

Move a page from one position to another.

#### Parameters

##### fromIndex

`number`

Current zero-based index of the page.

##### toIndex

`number`

Target zero-based index (after removal).

#### Returns

`void`

***

### removePage()

```ts
removePage(index): void;
```

Defined in: [src/core/pdfDocument.ts:488](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L488)

Remove a page by its zero-based index.

#### Parameters

##### index

`number`

Zero-based page index to remove.

#### Returns

`void`

#### Throws

RangeError if the index is out of bounds.

***

### save()

```ts
save(options?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/pdfDocument.ts:2314](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2314)

Serialize the document to a `Uint8Array`.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The complete PDF file as bytes.

***

### saveAsBase64()

```ts
saveAsBase64(options?): Promise<string>;
```

Defined in: [src/core/pdfDocument.ts:2394](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2394)

Serialize the document to a Base64-encoded string.

Useful for embedding PDFs in JSON payloads, data URIs, or
transferring over text-only channels.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md) & `object`

Standard save options plus an optional `dataUri`
                flag.  When `dataUri` is `true`, the returned
                string is prefixed with
                `data:application/pdf;base64,`.

#### Returns

`Promise`\&lt;`string`\&gt;

A Base64-encoded string of the PDF bytes.

#### Example

```ts
const b64 = await doc.saveAsBase64();
const dataUri = await doc.saveAsBase64({ dataUri: true });
// dataUri === "data:application/pdf;base64,JVBERi0..."
```

***

### saveAsBlob()

```ts
saveAsBlob(options?): Promise<Blob>;
```

Defined in: [src/core/pdfDocument.ts:2368](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2368)

Serialize the document to a `Blob`.

Convenient for client-side download links.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`Promise`\&lt;`Blob`\&gt;

***

### saveAsStream()

```ts
saveAsStream(options?): ReadableStream<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/pdfDocument.ts:2347](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L2347)

Serialize the document as a `ReadableStream<Uint8Array>`.

Ideal for streaming responses in edge/serverless environments.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`ReadableStream`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

***

### setAuthor()

```ts
setAuthor(author): void;
```

Defined in: [src/core/pdfDocument.ts:1567](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1567)

Set the document author.

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setCreationDate()

```ts
setCreationDate(date): void;
```

Defined in: [src/core/pdfDocument.ts:1592](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1592)

Set the document creation date.

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setCreator()

```ts
setCreator(creator): void;
```

Defined in: [src/core/pdfDocument.ts:1582](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1582)

Set the creator application name.

#### Parameters

##### creator

`string`

#### Returns

`void`

***

### setKeywords()

```ts
setKeywords(keywords): void;
```

Defined in: [src/core/pdfDocument.ts:1577](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1577)

Set the document keywords.

#### Parameters

##### keywords

`string` \| `string`[]

#### Returns

`void`

***

### setLanguage()

```ts
setLanguage(lang): void;
```

Defined in: [src/core/pdfDocument.ts:1931](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1931)

Set the document's natural language.

This is required by PDF/UA and should be a BCP 47 language tag
(e.g. `"en"`, `"en-US"`, `"de-DE"`, `"ja"`).

#### Parameters

##### lang

`string`

The BCP 47 language tag.

#### Returns

`void`

***

### setModDate()

```ts
setModDate(date): void;
```

Defined in: [src/core/pdfDocument.ts:1597](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1597)

Set the document modification date.

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setOutlines()

```ts
setOutlines(outlines): void;
```

Defined in: [src/core/pdfDocument.ts:1857](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1857)

Replace the outline tree for this document.

#### Parameters

##### outlines

[`PdfOutlineTree`](PdfOutlineTree.md)

The new outline tree.

#### Returns

`void`

***

### setProducer()

```ts
setProducer(producer): void;
```

Defined in: [src/core/pdfDocument.ts:1587](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1587)

Set the producer string (defaults to `"modern-pdf"`).

#### Parameters

##### producer

`string`

#### Returns

`void`

***

### setSubject()

```ts
setSubject(subject): void;
```

Defined in: [src/core/pdfDocument.ts:1572](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1572)

Set the document subject.

#### Parameters

##### subject

`string`

#### Returns

`void`

***

### setTitle()

```ts
setTitle(title, options?): void;
```

Defined in: [src/core/pdfDocument.ts:1559](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1559)

Set the document title.

#### Parameters

##### title

`string`

##### options?

[`SetTitleOptions`](../interfaces/SetTitleOptions.md)

#### Returns

`void`

***

### setViewerPreferences()

```ts
setViewerPreferences(prefs): void;
```

Defined in: [src/core/pdfDocument.ts:1992](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1992)

Set viewer preferences for this document.

Controls how the document is displayed when opened in a PDF viewer
(toolbar visibility, window sizing, print options, etc.).

Accepts either a plain [ViewerPreferences](../interfaces/ViewerPreferences.md) object or a
[PdfViewerPreferences](PdfViewerPreferences.md) class instance.

#### Parameters

##### prefs

  \| [`ViewerPreferences`](../interfaces/ViewerPreferences.md)
  \| [`PdfViewerPreferences`](PdfViewerPreferences.md)

The viewer preferences to set.

#### Returns

`void`

***

### setXmpMetadata()

```ts
setXmpMetadata(xmp): void;
```

Defined in: [src/core/pdfDocument.ts:1884](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1884)

Set raw XMP metadata as an XML string.

The string should be a valid XMP packet.  Use
[buildXmpMetadata](../functions/buildXmpMetadata.md) from `modern-pdf` to generate one
from standard metadata fields.

#### Parameters

##### xmp

`string`

The XMP XML string.

#### Returns

`void`

***

### sign()

```ts
sign(fieldName, options): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/pdfDocument.ts:1779](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1779)

Sign the PDF document.

Returns the signed PDF bytes. Uses incremental save to preserve
existing content and any previous signatures.

#### Parameters

##### fieldName

`string`

The signature field name.

##### options

[`SignOptions`](../interfaces/SignOptions.md)

Signing options (certificate, private key, etc.).

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The signed PDF bytes.

#### Example

```ts
const doc = await PdfDocument.load(pdfBytes);
const signedBytes = await doc.sign('Signature1', {
  certificate: certDer,
  privateKey: keyDer,
  reason: 'Document approval',
});
```

***

### use()

```ts
use(plugin): this;
```

Defined in: [src/core/pdfDocument.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L258)

Register a plugin on this document.

Plugins execute their lifecycle hooks in registration order.
The plugin's `onRegister` hook (if defined) is called immediately.

#### Parameters

##### plugin

[`PdfPlugin`](../interfaces/PdfPlugin.md)

The plugin to register.

#### Returns

`this`

This document (for chaining).

#### Example

```ts
import { createPdf } from 'modern-pdf-lib';
import { timestampPlugin } from 'modern-pdf-lib/plugins';

const doc = createPdf()
  .use(timestampPlugin())
  .use(myCustomPlugin);
```

***

### verifySignatures()

```ts
verifySignatures(): Promise<SignatureVerificationResult[]>;
```

Defined in: [src/core/pdfDocument.ts:1800](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L1800)

Verify all signatures in this document.

#### Returns

`Promise`\&lt;[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\&gt;

Array of verification results.

***

### create()

```ts
static create(): PdfDocument;
```

Defined in: [src/core/pdfDocument.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L193)

Create a new, empty PDF document.

This is the static-method equivalent of [createPdf](../functions/createPdf.md).

```ts
const doc = PdfDocument.create();
```

#### Returns

`PdfDocument`

***

### load()

```ts
static load(data, options?): Promise<PdfDocument>;
```

Defined in: [src/core/pdfDocument.ts:177](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfDocument.ts#L177)

Load an existing PDF document from raw bytes, an ArrayBuffer, or a
Base64-encoded string.

This is the primary entry point for parsing existing PDFs.  It
validates the file header, parses the cross-reference structure,
resolves the page tree and metadata, and returns a fully populated
PdfDocument that can be inspected or further modified.

#### Parameters

##### data

`string` \| `ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
                Base64-encoded string.

##### options?

[`LoadPdfOptions`](../interfaces/LoadPdfOptions.md)

Optional loading options (e.g. password, encryption).

#### Returns

`Promise`\&lt;`PdfDocument`\&gt;

A promise that resolves to the parsed PdfDocument.

#### Example

```ts
// From fetch (ArrayBuffer)
const pdfBytes = await fetch('document.pdf').then(r => r.arrayBuffer());
const doc = await PdfDocument.load(pdfBytes);

// From a Base64 string
const doc2 = await PdfDocument.load(base64String);
```
