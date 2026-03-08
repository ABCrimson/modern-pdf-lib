[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDocument

# Class: PdfDocument

Defined in: [src/core/pdfDocument.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L145)

The root document object.  Create via [createPdf](../functions/createPdf.md).

Manages:
- Page collection (ordered)
- Embedded resources (fonts, images)
- Document metadata (title, author, dates, …)
- Object-number allocation

## Constructors

### Constructor

> **new PdfDocument**(`registry?`): `PdfDocument`

Defined in: [src/core/pdfDocument.ts:219](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L219)

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

> **get** **pageCount**(): `number`

Defined in: [src/core/pdfDocument.ts:311](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L311)

The number of pages in this document.

##### Returns

`number`

## Methods

### addJavaScript()

> **addJavaScript**(`name`, `script`): `void`

Defined in: [src/core/pdfDocument.ts:2021](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2021)

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

> **addLayer**(`name`, `visible?`): [`PdfLayer`](PdfLayer.md)

Defined in: [src/core/pdfDocument.ts:1937](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1937)

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

> **addOutline**(`title`, `pageIndex`, `options?`): [`PdfOutlineItem`](PdfOutlineItem.md)

Defined in: [src/core/pdfDocument.ts:1697](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1697)

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

> **addPage**(`sizeOrPage?`): [`PdfPage`](PdfPage.md)

Defined in: [src/core/pdfDocument.ts:247](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L247)

Add a page to the document.

When called with a [PageSize](../type-aliases/PageSize.md) (or no argument), a new blank page
is created.  When called with an existing [PdfPage](PdfPage.md) instance
(e.g. one returned by [copyPages](#copypages)), that page is inserted
directly.

#### Parameters

##### sizeOrPage?

A page size as `[width, height]` tuple,
                   `{ width, height }` object, one of the
                   [PageSizes](../variables/PageSizes.md) constants, or an existing
                   [PdfPage](PdfPage.md) instance.  Defaults to A4.

[`PdfPage`](PdfPage.md) | [`PageSize`](../type-aliases/PageSize.md)

#### Returns

[`PdfPage`](PdfPage.md)

The [PdfPage](PdfPage.md) that was added.

***

### addSignatureField()

> **addSignatureField**(`pageIndex`, `rect`, `name`): `void`

Defined in: [src/core/pdfDocument.ts:1599](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1599)

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

> **addWatermark**(`options`): `void`

Defined in: [src/core/pdfDocument.ts:2034](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2034)

Add a text watermark to all pages in the document.

#### Parameters

##### options

[`WatermarkOptions`](../interfaces/WatermarkOptions.md)

Watermark appearance options.

#### Returns

`void`

***

### applyRedactions()

> **applyRedactions**(): `void`

Defined in: [src/core/pdfDocument.ts:2135](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2135)

Apply all pending redactions across all pages.

Redaction marks are added to individual pages using
`page.markForRedaction()`.  This method draws the redaction
rectangles on all pages that have pending marks.

#### Returns

`void`

***

### attachFile()

> **attachFile**(`name`, `data`, `mimeType`, `options?`): `void`

Defined in: [src/core/pdfDocument.ts:1969](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1969)

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

> **checkAccessibility**(): [`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

Defined in: [src/core/pdfDocument.ts:1814](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1814)

Run accessibility checks on this document.

Validates the document against PDF/UA requirements and general
accessibility best practices.

#### Returns

[`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

An array of [AccessibilityIssue](../interfaces/AccessibilityIssue.md) objects.

***

### copy()

> **copy**(): `Promise`\<`PdfDocument`\>

Defined in: [src/core/pdfDocument.ts:2161](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2161)

Create an independent deep copy of this document.

The copy is produced by serializing the document to bytes and then
re-parsing those bytes.  This guarantees that the returned
`PdfDocument` is completely independent — mutations to the copy
do not affect the original, and vice versa.

#### Returns

`Promise`\<`PdfDocument`\>

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

> **copyPages**(`sourceDoc`, `indices`): `Promise`\<[`PdfPage`](PdfPage.md)[]\>

Defined in: [src/core/pdfDocument.ts:472](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L472)

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

`Promise`\<[`PdfPage`](PdfPage.md)[]\>

The newly created pages in this document.

***

### createSoftMask()

> **createSoftMask**(`width`, `height`, `builder`): [`SoftMaskRef`](../interfaces/SoftMaskRef.md)

Defined in: [src/core/pdfDocument.ts:2072](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2072)

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

(`ops`) => `void`

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

> **createStructureTree**(): [`PdfStructureTree`](PdfStructureTree.md)

Defined in: [src/core/pdfDocument.ts:1780](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1780)

Create a new structure tree for this document.

If a structure tree already exists, it is returned as-is.
Call this to begin making the document accessible (tagged PDF).

#### Returns

[`PdfStructureTree`](PdfStructureTree.md)

The [PdfStructureTree](PdfStructureTree.md) for this document.

***

### drawSvg()

> **drawSvg**(`pageIndex`, `svgString`, `options?`): `void`

Defined in: [src/core/pdfDocument.ts:1918](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1918)

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

> **embedFont**(`fontNameOrData`, `options?`): `Promise`\<[`FontRef`](../interfaces/FontRef.md)\>

Defined in: [src/core/pdfDocument.ts:520](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L520)

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

Base font name string or raw TTF/OTF bytes.

`string` | `Uint8Array`\<`ArrayBufferLike`\>

##### options?

[`EmbedFontOptions`](../interfaces/EmbedFontOptions.md)

Optional embedding options (subset, OpenType features).

#### Returns

`Promise`\<[`FontRef`](../interfaces/FontRef.md)\>

A [FontRef](../interfaces/FontRef.md) to pass to drawing methods.

***

### embedImage()

> **embedImage**(`imageData`): `Promise`\<[`ImageRef`](../interfaces/ImageRef.md)\>

Defined in: [src/core/pdfDocument.ts:1291](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1291)

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

Raw image file bytes (PNG, JPEG, WebP, or TIFF).

`ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`Promise`\<[`ImageRef`](../interfaces/ImageRef.md)\>

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

### embedJpeg()

> **embedJpeg**(`jpegData`): `Promise`\<[`ImageRef`](../interfaces/ImageRef.md)\>

Defined in: [src/core/pdfDocument.ts:1007](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1007)

Embed a JPEG image.

JPEG data can be embedded directly as a PDF stream with
`DCTDecode` filter — no re-encoding is needed.

#### Parameters

##### jpegData

Raw JPEG file bytes as a `Uint8Array` or `ArrayBuffer`.

`ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`Promise`\<[`ImageRef`](../interfaces/ImageRef.md)\>

An [ImageRef](../interfaces/ImageRef.md).

***

### embedPage()

> **embedPage**(`page`, `options?`): [`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)

Defined in: [src/core/pdfDocument.ts:1391](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1391)

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

> **embedPages**(`pages`): [`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]

Defined in: [src/core/pdfDocument.ts:1412](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1412)

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

> **embedPdf**(`data`, `pageIndices?`, `options?`): `Promise`\<[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]\>

Defined in: [src/core/pdfDocument.ts:1340](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1340)

Embed pages from another PDF as Form XObjects.

Each embedded page is turned into a self-contained Form XObject that
can be painted onto any page via `page.drawPage()`.  The source PDF's
content streams are decoded and concatenated, and all referenced
resources (fonts, images, etc.) are deep-cloned into this document's
registry.

#### Parameters

##### data

Raw PDF bytes (Uint8Array or ArrayBuffer).

`ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

##### pageIndices?

`number`[]

Zero-based page indices to embed.  Defaults to
                    `[0]` (first page only).

##### options?

[`EmbedPageOptions`](../interfaces/EmbedPageOptions.md)

#### Returns

`Promise`\<[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]\>

Array of [EmbeddedPdfPage](../interfaces/EmbeddedPdfPage.md) handles.

#### Example

```ts
const [embeddedPage] = await doc.embedPdf(existingPdfBytes, [0]);
page.drawPage(embeddedPage, { x: 50, y: 50, width: 300, height: 400 });
```

***

### embedPng()

> **embedPng**(`pngData`): [`ImageRef`](../interfaces/ImageRef.md)

Defined in: [src/core/pdfDocument.ts:914](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L914)

Embed a PNG image.

Fully decodes the PNG (including filter reconstruction and alpha
channel separation) and creates a correct PDF image XObject.
For images with transparency, a separate SMask XObject is created
and referenced from the main image.

#### Parameters

##### pngData

Raw PNG file bytes as a `Uint8Array` or `ArrayBuffer`.

`ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

[`ImageRef`](../interfaces/ImageRef.md)

An [ImageRef](../interfaces/ImageRef.md) to pass to `page.drawImage()`.

***

### embedTiff()

> **embedTiff**(`tiffData`, `options?`): [`ImageRef`](../interfaces/ImageRef.md)

Defined in: [src/core/pdfDocument.ts:1166](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1166)

Embed a TIFF image.

Decodes the TIFF image and creates a PDF image XObject with
FlateDecode compression. For multi-page TIFFs, a specific page
can be selected via options.

#### Parameters

##### tiffData

Raw TIFF file bytes as a `Uint8Array` or `ArrayBuffer`.

`ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

##### options?

Options (e.g., `{ page: 0 }` for multi-page TIFFs).

###### page?

`number`

#### Returns

[`ImageRef`](../interfaces/ImageRef.md)

An [ImageRef](../interfaces/ImageRef.md).

***

### embedWebP()

> **embedWebP**(`webpData`): [`ImageRef`](../interfaces/ImageRef.md)

Defined in: [src/core/pdfDocument.ts:1057](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1057)

Embed a WebP image.

WebP cannot be directly embedded in PDF. This method decodes the
WebP image to raw pixels (VP8/lossy, VP8L/lossless, or VP8+ALPH),
then embeds as a FlateDecode image XObject. If the WebP has
transparency, the alpha channel is embedded as a soft mask.

#### Parameters

##### webpData

Raw WebP file bytes as a `Uint8Array` or `ArrayBuffer`.

`ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

[`ImageRef`](../interfaces/ImageRef.md)

An [ImageRef](../interfaces/ImageRef.md).

***

### encrypt()

> **encrypt**(`options`): `Promise`\<`void`\>

Defined in: [src/core/pdfDocument.ts:1536](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1536)

Configure encryption for this document.

When encryption is set, the document will be encrypted on the next
call to `save()`.  The /Encrypt dictionary and file ID are
generated automatically.

#### Parameters

##### options

[`EncryptOptions`](../interfaces/EncryptOptions.md)

Encryption options (passwords, permissions, algorithm).

#### Returns

`Promise`\<`void`\>

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

> **getAttachments**(): [`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

Defined in: [src/core/pdfDocument.ts:1994](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1994)

Get all file attachments in this document.

Note: Currently returns information about files attached via
this API.  For parsing attachments from loaded PDFs, use the
lower-level `getAttachments()` function.

#### Returns

[`EmbeddedFile`](../interfaces/EmbeddedFile.md)[]

An array of embedded file metadata.

***

### getAuthor()

> **getAuthor**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1473](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1473)

Get the document author, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getCreationDate()

> **getCreationDate**(): `Date` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1498](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1498)

Get the document creation date.

#### Returns

`Date` \| `undefined`

***

### getCreator()

> **getCreator**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1488](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1488)

Get the creator application name, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getForm()

> **getForm**(): [`PdfForm`](PdfForm.md)

Defined in: [src/core/pdfDocument.ts:1890](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1890)

Get the interactive form (AcroForm) for this document.

If the document does not yet have a form, an empty one is created.
The form provides access to all form fields and supports fill,
flatten, and field creation operations.

#### Returns

[`PdfForm`](PdfForm.md)

The [PdfForm](PdfForm.md) for this document.

***

### getKeywords()

> **getKeywords**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1483](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1483)

Get the document keywords, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getLanguage()

> **getLanguage**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1802](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1802)

Get the document's natural language, or `undefined` if not set.

#### Returns

`string` \| `undefined`

The BCP 47 language tag, or `undefined`.

***

### getLayers()

> **getLayers**(): [`PdfLayer`](PdfLayer.md)[]

Defined in: [src/core/pdfDocument.ts:1947](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1947)

Get all layers in this document.

#### Returns

[`PdfLayer`](PdfLayer.md)[]

An array of [PdfLayer](PdfLayer.md) objects.

***

### getModDate()

> **getModDate**(): `Date` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1503](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1503)

Get the document modification date, or `undefined` if not set.

#### Returns

`Date` \| `undefined`

***

### getOutlines()

> **getOutlines**(): [`PdfOutlineTree`](PdfOutlineTree.md)

Defined in: [src/core/pdfDocument.ts:1681](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1681)

Get the outline (bookmark) tree for this document.

If no outlines have been added, returns an empty tree.

#### Returns

[`PdfOutlineTree`](PdfOutlineTree.md)

The [PdfOutlineTree](PdfOutlineTree.md) for this document.

***

### getPage()

> **getPage**(`index`): [`PdfPage`](PdfPage.md)

Defined in: [src/core/pdfDocument.ts:287](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L287)

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

> **getPageCount**(): `number`

Defined in: [src/core/pdfDocument.ts:306](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L306)

Return the page count.

#### Returns

`number`

***

### getPages()

> **getPages**(): readonly [`PdfPage`](PdfPage.md)[]

Defined in: [src/core/pdfDocument.ts:299](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L299)

Return all pages.

#### Returns

readonly [`PdfPage`](PdfPage.md)[]

***

### getPermissions()

> **getPermissions**(): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md) \| `undefined`

Defined in: [src/core/pdfDocument.ts:1556](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1556)

Get the permission flags for this document, if encrypted.

#### Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md) \| `undefined`

The decoded permission flags, or `undefined` if the
          document is not encrypted.

***

### getProducer()

> **getProducer**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1493](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1493)

Get the producer string.

#### Returns

`string` \| `undefined`

***

### getSignatures()

> **getSignatures**(): [`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Defined in: [src/core/pdfDocument.ts:1652](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1652)

Get information about all signatures in this document.

#### Returns

[`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Array of signature info objects.

***

### getStructureTree()

> **getStructureTree**(): [`PdfStructureTree`](PdfStructureTree.md) \| `undefined`

Defined in: [src/core/pdfDocument.ts:1768](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1768)

Get the structure tree for this document, or `undefined` if
no structure tree has been created.

A structure tree is required for tagged PDF / PDF/UA compliance.

#### Returns

[`PdfStructureTree`](PdfStructureTree.md) \| `undefined`

The [PdfStructureTree](PdfStructureTree.md), or `undefined`.

***

### getSubject()

> **getSubject**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1478](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1478)

Get the document subject, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getTitle()

> **getTitle**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1468](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1468)

Get the document title, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getViewerPreferences()

> **getViewerPreferences**(): [`PdfViewerPreferences`](PdfViewerPreferences.md)

Defined in: [src/core/pdfDocument.ts:1836](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1836)

Get the viewer preferences for this document as a
[PdfViewerPreferences](PdfViewerPreferences.md) instance with getter/setter pairs.

If no preferences have been set, a default (empty) instance is
returned.  The instance is cached so that repeated calls return
the same object and mutations are preserved.

#### Returns

[`PdfViewerPreferences`](PdfViewerPreferences.md)

***

### getXmpMetadata()

> **getXmpMetadata**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1733](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1733)

Get the raw XMP metadata string, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### hasForm()

> **hasForm**(): `boolean`

Defined in: [src/core/pdfDocument.ts:1877](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1877)

Check whether this document has an AcroForm (interactive form).

Returns `true` if a form has been created or if the document
was loaded from a PDF that contains an /AcroForm dictionary.

#### Returns

`boolean`

***

### insertPage()

> **insertPage**(`index`, `size?`): [`PdfPage`](PdfPage.md)

Defined in: [src/core/pdfDocument.ts:400](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L400)

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

> **isEncrypted**(): `boolean`

Defined in: [src/core/pdfDocument.ts:1546](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1546)

Check whether this document has encryption configured.

Returns `true` if `encrypt()` has been called on this document,
or if the document was loaded from an encrypted PDF.

#### Returns

`boolean`

***

### movePage()

> **movePage**(`fromIndex`, `toIndex`): `void`

Defined in: [src/core/pdfDocument.ts:441](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L441)

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

> **removePage**(`index`): `void`

Defined in: [src/core/pdfDocument.ts:426](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L426)

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

> **save**(`options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/pdfDocument.ts:2176](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2176)

Serialize the document to a `Uint8Array`.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The complete PDF file as bytes.

***

### saveAsBase64()

> **saveAsBase64**(`options?`): `Promise`\<`string`\>

Defined in: [src/core/pdfDocument.ts:2243](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2243)

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

`Promise`\<`string`\>

A Base64-encoded string of the PDF bytes.

#### Example

```ts
const b64 = await doc.saveAsBase64();
const dataUri = await doc.saveAsBase64({ dataUri: true });
// dataUri === "data:application/pdf;base64,JVBERi0..."
```

***

### saveAsBlob()

> **saveAsBlob**(`options?`): `Promise`\<`Blob`\>

Defined in: [src/core/pdfDocument.ts:2217](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2217)

Serialize the document to a `Blob`.

Convenient for client-side download links.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`Promise`\<`Blob`\>

***

### saveAsStream()

> **saveAsStream**(`options?`): `ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/pdfDocument.ts:2196](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L2196)

Serialize the document as a `ReadableStream<Uint8Array>`.

Ideal for streaming responses in edge/serverless environments.

#### Parameters

##### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Compression and serialization options.

#### Returns

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### setAuthor()

> **setAuthor**(`author`): `void`

Defined in: [src/core/pdfDocument.ts:1429](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1429)

Set the document author.

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setCreationDate()

> **setCreationDate**(`date`): `void`

Defined in: [src/core/pdfDocument.ts:1454](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1454)

Set the document creation date.

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setCreator()

> **setCreator**(`creator`): `void`

Defined in: [src/core/pdfDocument.ts:1444](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1444)

Set the creator application name.

#### Parameters

##### creator

`string`

#### Returns

`void`

***

### setKeywords()

> **setKeywords**(`keywords`): `void`

Defined in: [src/core/pdfDocument.ts:1439](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1439)

Set the document keywords.

#### Parameters

##### keywords

`string` | `string`[]

#### Returns

`void`

***

### setLanguage()

> **setLanguage**(`lang`): `void`

Defined in: [src/core/pdfDocument.ts:1793](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1793)

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

> **setModDate**(`date`): `void`

Defined in: [src/core/pdfDocument.ts:1459](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1459)

Set the document modification date.

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setOutlines()

> **setOutlines**(`outlines`): `void`

Defined in: [src/core/pdfDocument.ts:1719](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1719)

Replace the outline tree for this document.

#### Parameters

##### outlines

[`PdfOutlineTree`](PdfOutlineTree.md)

The new outline tree.

#### Returns

`void`

***

### setProducer()

> **setProducer**(`producer`): `void`

Defined in: [src/core/pdfDocument.ts:1449](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1449)

Set the producer string (defaults to `"modern-pdf"`).

#### Parameters

##### producer

`string`

#### Returns

`void`

***

### setSubject()

> **setSubject**(`subject`): `void`

Defined in: [src/core/pdfDocument.ts:1434](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1434)

Set the document subject.

#### Parameters

##### subject

`string`

#### Returns

`void`

***

### setTitle()

> **setTitle**(`title`, `options?`): `void`

Defined in: [src/core/pdfDocument.ts:1421](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1421)

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

> **setViewerPreferences**(`prefs`): `void`

Defined in: [src/core/pdfDocument.ts:1854](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1854)

Set viewer preferences for this document.

Controls how the document is displayed when opened in a PDF viewer
(toolbar visibility, window sizing, print options, etc.).

Accepts either a plain [ViewerPreferences](../interfaces/ViewerPreferences.md) object or a
[PdfViewerPreferences](PdfViewerPreferences.md) class instance.

#### Parameters

##### prefs

The viewer preferences to set.

[`ViewerPreferences`](../interfaces/ViewerPreferences.md) | [`PdfViewerPreferences`](PdfViewerPreferences.md)

#### Returns

`void`

***

### setXmpMetadata()

> **setXmpMetadata**(`xmp`): `void`

Defined in: [src/core/pdfDocument.ts:1746](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1746)

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

> **sign**(`fieldName`, `options`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/core/pdfDocument.ts:1641](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1641)

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

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

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

### verifySignatures()

> **verifySignatures**(): `Promise`\<[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\>

Defined in: [src/core/pdfDocument.ts:1662](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L1662)

Verify all signatures in this document.

#### Returns

`Promise`\<[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\>

Array of verification results.

***

### create()

> `static` **create**(): `PdfDocument`

Defined in: [src/core/pdfDocument.ts:190](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L190)

Create a new, empty PDF document.

This is the static-method equivalent of [createPdf](../functions/createPdf.md).

```ts
const doc = PdfDocument.create();
```

#### Returns

`PdfDocument`

***

### load()

> `static` **load**(`data`, `options?`): `Promise`\<`PdfDocument`\>

Defined in: [src/core/pdfDocument.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfDocument.ts#L174)

Load an existing PDF document from raw bytes, an ArrayBuffer, or a
Base64-encoded string.

This is the primary entry point for parsing existing PDFs.  It
validates the file header, parses the cross-reference structure,
resolves the page tree and metadata, and returns a fully populated
PdfDocument that can be inspected or further modified.

#### Parameters

##### data

The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
                Base64-encoded string.

`string` | `ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

##### options?

[`LoadPdfOptions`](../interfaces/LoadPdfOptions.md)

Optional loading options (e.g. password, encryption).

#### Returns

`Promise`\<`PdfDocument`\>

A promise that resolves to the parsed PdfDocument.

#### Example

```ts
// From fetch (ArrayBuffer)
const pdfBytes = await fetch('document.pdf').then(r => r.arrayBuffer());
const doc = await PdfDocument.load(pdfBytes);

// From a Base64 string
const doc2 = await PdfDocument.load(base64String);
```
