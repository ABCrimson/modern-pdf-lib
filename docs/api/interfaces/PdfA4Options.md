[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfA4Options

# Interface: PdfA4Options

Defined in: [src/compliance/pdfA4.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L58)

Options for generating PDF/A-4 XMP metadata.

## Properties

### extensionSchemas?

```ts
readonly optional extensionSchemas?: readonly PdfA4ExtensionSchema[];
```

Defined in: [src/compliance/pdfA4.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L64)

Extension schemas to declare under `pdfaExtension:schemas`.

***

### level?

```ts
readonly optional level?: PdfA4Level;
```

Defined in: [src/compliance/pdfA4.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L60)

Conformance variant. Default: `'PDF/A-4'`.

***

### title?

```ts
readonly optional title?: string;
```

Defined in: [src/compliance/pdfA4.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L62)

Document title (Dublin Core `dc:title`).
