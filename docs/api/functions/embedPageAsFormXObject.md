[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedPageAsFormXObject

# Function: embedPageAsFormXObject()

> **embedPageAsFormXObject**(`page`, `sourceRegistry`, `targetRegistry`, `xObjectName`, `options?`): [`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)

Defined in: [src/core/pdfEmbed.ts:264](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfEmbed.ts#L264)

Embed a single page as a Form XObject in the target registry.

The page's content stream(s) are decoded and concatenated.  The
page's resources are deep-cloned into the target registry.  The
result is a PdfStream of Subtype /Form registered in the target.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The source PdfPage to embed.

### sourceRegistry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The source document's object registry.

### targetRegistry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The target document's object registry.

### xObjectName

`string`

The resource name to assign (e.g. `'XF1'`).

### options?

[`EmbedPageOptions`](../interfaces/EmbedPageOptions.md)

## Returns

[`EmbeddedPdfPage`](../interfaces/EmbeddedPdfPage.md)

An EmbeddedPdfPage handle.
