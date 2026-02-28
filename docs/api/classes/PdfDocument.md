[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDocument

# Class: PdfDocument

Defined in: [src/core/pdfDocument.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L138)

The root document object.  Create via [createPdf](../functions/createPdf.md).

Manages:
- Page collection (ordered)
- Embedded resources (fonts, images)
- Document metadata (title, author, dates, …)
- Object-number allocation

## Constructors

### Constructor

> **new PdfDocument**(`registry?`): `PdfDocument`

Defined in: [src/core/pdfDocument.ts:212](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L212)

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

Defined in: [src/core/pdfDocument.ts:304](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L304)

The number of pages in this document.

##### Returns

`number`

## Methods

### addJavaScript()

> **addJavaScript**(`name`, `script`): `void`

Defined in: [src/core/pdfDocument.ts:1797](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1797)

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

Defined in: [src/core/pdfDocument.ts:1713](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1713)

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

Defined in: [src/core/pdfDocument.ts:1473](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1473)

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

Defined in: [src/core/pdfDocument.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L240)

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

Defined in: [src/core/pdfDocument.ts:1375](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1375)

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

Defined in: [src/core/pdfDocument.ts:1810](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1810)

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

Defined in: [src/core/pdfDocument.ts:1825](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1825)

Apply all pending redactions across all pages.

Redaction marks are added to individual pages using
`page.markForRedaction()`.  This method draws the redaction
rectangles on all pages that have pending marks.

#### Returns

`void`

***

### attachFile()

> **attachFile**(`name`, `data`, `mimeType`, `options?`): `void`

Defined in: [src/core/pdfDocument.ts:1745](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1745)

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

Defined in: [src/core/pdfDocument.ts:1590](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1590)

Run accessibility checks on this document.

Validates the document against PDF/UA requirements and general
accessibility best practices.

#### Returns

[`AccessibilityIssue`](../interfaces/AccessibilityIssue.md)[]

An array of [AccessibilityIssue](../interfaces/AccessibilityIssue.md) objects.

***

### copy()

> **copy**(): `Promise`\<`PdfDocument`\>

Defined in: [src/core/pdfDocument.ts:1851](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1851)

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

Defined in: [src/core/pdfDocument.ts:465](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L465)

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

### createStructureTree()

> **createStructureTree**(): [`PdfStructureTree`](PdfStructureTree.md)

Defined in: [src/core/pdfDocument.ts:1556](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1556)

Create a new structure tree for this document.

If a structure tree already exists, it is returned as-is.
Call this to begin making the document accessible (tagged PDF).

#### Returns

[`PdfStructureTree`](PdfStructureTree.md)

The [PdfStructureTree](PdfStructureTree.md) for this document.

***

### drawSvg()

> **drawSvg**(`pageIndex`, `svgString`, `options?`): `void`

Defined in: [src/core/pdfDocument.ts:1694](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1694)

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

Defined in: [src/core/pdfDocument.ts:513](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L513)

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

### embedJpeg()

> **embedJpeg**(`jpegData`): `Promise`\<[`ImageRef`](../interfaces/ImageRef.md)\>

Defined in: [src/core/pdfDocument.ts:1053](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1053)

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

Defined in: [src/core/pdfDocument.ts:1167](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1167)

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

> **embedPages**(`pages`): `Promise`\<[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]\>

Defined in: [src/core/pdfDocument.ts:1188](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1188)

Embed multiple pages as Form XObjects in batch.
Convenience wrapper around [embedPage](#embedpage).

#### Parameters

##### pages

[`PdfPage`](PdfPage.md)[]

Array of PdfPage instances to embed.

#### Returns

`Promise`\<[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]\>

Array of [EmbeddedPdfPage](../interfaces/EmbeddedPdfPage.md) handles, one per input page.

***

### embedPdf()

> **embedPdf**(`data`, `pageIndices?`, `options?`): `Promise`\<[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)[]\>

Defined in: [src/core/pdfDocument.ts:1116](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1116)

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

Defined in: [src/core/pdfDocument.ts:960](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L960)

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

### encrypt()

> **encrypt**(`options`): `Promise`\<`void`\>

Defined in: [src/core/pdfDocument.ts:1312](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1312)

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

Defined in: [src/core/pdfDocument.ts:1770](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1770)

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

Defined in: [src/core/pdfDocument.ts:1249](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1249)

Get the document author, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getCreationDate()

> **getCreationDate**(): `Date` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1274](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1274)

Get the document creation date.

#### Returns

`Date` \| `undefined`

***

### getCreator()

> **getCreator**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1264](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1264)

Get the creator application name, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getForm()

> **getForm**(): [`PdfForm`](PdfForm.md)

Defined in: [src/core/pdfDocument.ts:1666](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1666)

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

Defined in: [src/core/pdfDocument.ts:1259](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1259)

Get the document keywords, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getLanguage()

> **getLanguage**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1578](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1578)

Get the document's natural language, or `undefined` if not set.

#### Returns

`string` \| `undefined`

The BCP 47 language tag, or `undefined`.

***

### getLayers()

> **getLayers**(): [`PdfLayer`](PdfLayer.md)[]

Defined in: [src/core/pdfDocument.ts:1723](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1723)

Get all layers in this document.

#### Returns

[`PdfLayer`](PdfLayer.md)[]

An array of [PdfLayer](PdfLayer.md) objects.

***

### getModDate()

> **getModDate**(): `Date` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1279](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1279)

Get the document modification date, or `undefined` if not set.

#### Returns

`Date` \| `undefined`

***

### getOutlines()

> **getOutlines**(): [`PdfOutlineTree`](PdfOutlineTree.md)

Defined in: [src/core/pdfDocument.ts:1457](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1457)

Get the outline (bookmark) tree for this document.

If no outlines have been added, returns an empty tree.

#### Returns

[`PdfOutlineTree`](PdfOutlineTree.md)

The [PdfOutlineTree](PdfOutlineTree.md) for this document.

***

### getPage()

> **getPage**(`index`): [`PdfPage`](PdfPage.md)

Defined in: [src/core/pdfDocument.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L280)

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

Defined in: [src/core/pdfDocument.ts:299](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L299)

Return the page count.

#### Returns

`number`

***

### getPages()

> **getPages**(): readonly [`PdfPage`](PdfPage.md)[]

Defined in: [src/core/pdfDocument.ts:292](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L292)

Return all pages.

#### Returns

readonly [`PdfPage`](PdfPage.md)[]

***

### getPermissions()

> **getPermissions**(): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md) \| `undefined`

Defined in: [src/core/pdfDocument.ts:1332](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1332)

Get the permission flags for this document, if encrypted.

#### Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md) \| `undefined`

The decoded permission flags, or `undefined` if the
          document is not encrypted.

***

### getProducer()

> **getProducer**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1269](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1269)

Get the producer string.

#### Returns

`string` \| `undefined`

***

### getSignatures()

> **getSignatures**(): [`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Defined in: [src/core/pdfDocument.ts:1428](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1428)

Get information about all signatures in this document.

#### Returns

[`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Array of signature info objects.

***

### getStructureTree()

> **getStructureTree**(): [`PdfStructureTree`](PdfStructureTree.md) \| `undefined`

Defined in: [src/core/pdfDocument.ts:1544](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1544)

Get the structure tree for this document, or `undefined` if
no structure tree has been created.

A structure tree is required for tagged PDF / PDF/UA compliance.

#### Returns

[`PdfStructureTree`](PdfStructureTree.md) \| `undefined`

The [PdfStructureTree](PdfStructureTree.md), or `undefined`.

***

### getSubject()

> **getSubject**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1254](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1254)

Get the document subject, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getTitle()

> **getTitle**(): `string` \| `undefined`

Defined in: [src/core/pdfDocument.ts:1244](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1244)

Get the document title, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### getViewerPreferences()

> **getViewerPreferences**(): [`PdfViewerPreferences`](PdfViewerPreferences.md)

Defined in: [src/core/pdfDocument.ts:1612](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1612)

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

Defined in: [src/core/pdfDocument.ts:1509](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1509)

Get the raw XMP metadata string, or `undefined` if not set.

#### Returns

`string` \| `undefined`

***

### hasForm()

> **hasForm**(): `boolean`

Defined in: [src/core/pdfDocument.ts:1653](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1653)

Check whether this document has an AcroForm (interactive form).

Returns `true` if a form has been created or if the document
was loaded from a PDF that contains an /AcroForm dictionary.

#### Returns

`boolean`

***

### insertPage()

> **insertPage**(`index`, `size?`): [`PdfPage`](PdfPage.md)

Defined in: [src/core/pdfDocument.ts:393](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L393)

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

Defined in: [src/core/pdfDocument.ts:1322](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1322)

Check whether this document has encryption configured.

Returns `true` if `encrypt()` has been called on this document,
or if the document was loaded from an encrypted PDF.

#### Returns

`boolean`

***

### movePage()

> **movePage**(`fromIndex`, `toIndex`): `void`

Defined in: [src/core/pdfDocument.ts:434](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L434)

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

Defined in: [src/core/pdfDocument.ts:419](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L419)

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

Defined in: [src/core/pdfDocument.ts:1866](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1866)

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

Defined in: [src/core/pdfDocument.ts:1933](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1933)

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

Defined in: [src/core/pdfDocument.ts:1907](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1907)

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

Defined in: [src/core/pdfDocument.ts:1886](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1886)

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

Defined in: [src/core/pdfDocument.ts:1205](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1205)

Set the document author.

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setCreationDate()

> **setCreationDate**(`date`): `void`

Defined in: [src/core/pdfDocument.ts:1230](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1230)

Set the document creation date.

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setCreator()

> **setCreator**(`creator`): `void`

Defined in: [src/core/pdfDocument.ts:1220](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1220)

Set the creator application name.

#### Parameters

##### creator

`string`

#### Returns

`void`

***

### setKeywords()

> **setKeywords**(`keywords`): `void`

Defined in: [src/core/pdfDocument.ts:1215](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1215)

Set the document keywords.

#### Parameters

##### keywords

`string` | `string`[]

#### Returns

`void`

***

### setLanguage()

> **setLanguage**(`lang`): `void`

Defined in: [src/core/pdfDocument.ts:1569](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1569)

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

Defined in: [src/core/pdfDocument.ts:1235](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1235)

Set the document modification date.

#### Parameters

##### date

`Date`

#### Returns

`void`

***

### setOutlines()

> **setOutlines**(`outlines`): `void`

Defined in: [src/core/pdfDocument.ts:1495](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1495)

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

Defined in: [src/core/pdfDocument.ts:1225](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1225)

Set the producer string (defaults to `"modern-pdf"`).

#### Parameters

##### producer

`string`

#### Returns

`void`

***

### setSubject()

> **setSubject**(`subject`): `void`

Defined in: [src/core/pdfDocument.ts:1210](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1210)

Set the document subject.

#### Parameters

##### subject

`string`

#### Returns

`void`

***

### setTitle()

> **setTitle**(`title`, `options?`): `void`

Defined in: [src/core/pdfDocument.ts:1197](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1197)

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

Defined in: [src/core/pdfDocument.ts:1630](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1630)

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

Defined in: [src/core/pdfDocument.ts:1522](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1522)

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

Defined in: [src/core/pdfDocument.ts:1417](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1417)

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

Defined in: [src/core/pdfDocument.ts:1438](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L1438)

Verify all signatures in this document.

#### Returns

`Promise`\<[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\>

Array of verification results.

***

### create()

> `static` **create**(): `PdfDocument`

Defined in: [src/core/pdfDocument.ts:183](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L183)

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

Defined in: [src/core/pdfDocument.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfDocument.ts#L167)

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
