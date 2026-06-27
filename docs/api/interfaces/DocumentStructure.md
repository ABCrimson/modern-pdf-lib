[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocumentStructure

# Interface: DocumentStructure

Defined in: [src/core/pdfCatalog.ts:310](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfCatalog.ts#L310)

High-level helper that wires together the catalog, page tree, and info
dict, returning all the references the writer needs.

## Properties

### catalogRef

```ts
catalogRef: PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfCatalog.ts#L312)

Reference to the /Catalog.

***

### infoRef

```ts
infoRef: PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:314](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfCatalog.ts#L314)

Reference to the /Info dict.

***

### pagesRef

```ts
pagesRef: PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:316](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfCatalog.ts#L316)

Reference to the /Pages node.
