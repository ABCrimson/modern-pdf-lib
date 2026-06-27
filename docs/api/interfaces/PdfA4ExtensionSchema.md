[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfA4ExtensionSchema

# Interface: PdfA4ExtensionSchema

Defined in: [src/compliance/pdfA4.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L46)

Describes a PDF/A extension schema for non-standard XMP namespaces.

## Properties

### namespaceUri

```ts
readonly namespaceUri: string;
```

Defined in: [src/compliance/pdfA4.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L48)

Namespace URI of the extended schema.

***

### prefix

```ts
readonly prefix: string;
```

Defined in: [src/compliance/pdfA4.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L50)

Preferred namespace prefix.

***

### properties

```ts
readonly properties: readonly PdfA4ExtensionProperty[];
```

Defined in: [src/compliance/pdfA4.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L54)

Properties defined by this schema.

***

### schema

```ts
readonly schema: string;
```

Defined in: [src/compliance/pdfA4.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L52)

Human-readable schema name.
