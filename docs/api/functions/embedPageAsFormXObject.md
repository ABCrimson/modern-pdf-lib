[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedPageAsFormXObject

# Function: embedPageAsFormXObject()

```ts
function embedPageAsFormXObject(
   page, 
   sourceRegistry, 
   targetRegistry, 
   xObjectName, 
   options?): EmbeddedPdfPage;
```

Defined in: [src/core/pdfEmbed.ts:253](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfEmbed.ts#L253)

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
