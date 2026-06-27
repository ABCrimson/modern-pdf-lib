[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfA4ExtensionProperty

# Interface: PdfA4ExtensionProperty

Defined in: [src/compliance/pdfA4.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L34)

A single property within a PDF/A extension schema.

## Properties

### category

```ts
readonly category: "external" | "internal";
```

Defined in: [src/compliance/pdfA4.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L40)

Whether the property is internally or externally derived.

***

### description

```ts
readonly description: string;
```

Defined in: [src/compliance/pdfA4.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L42)

Human-readable description of the property.

***

### name

```ts
readonly name: string;
```

Defined in: [src/compliance/pdfA4.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L36)

Property name.

***

### valueType

```ts
readonly valueType: string;
```

Defined in: [src/compliance/pdfA4.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfA4.ts#L38)

XMP value type (e.g. 'Text', 'Integer', 'Boolean').
