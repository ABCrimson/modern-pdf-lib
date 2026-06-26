[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfA4ExtensionProperty

# Interface: PdfA4ExtensionProperty

Defined in: src/compliance/pdfA4.ts:34

A single property within a PDF/A extension schema.

## Properties

### category

> `readonly` **category**: `"external"` \| `"internal"`

Defined in: src/compliance/pdfA4.ts:40

Whether the property is internally or externally derived.

***

### description

> `readonly` **description**: `string`

Defined in: src/compliance/pdfA4.ts:42

Human-readable description of the property.

***

### name

> `readonly` **name**: `string`

Defined in: src/compliance/pdfA4.ts:36

Property name.

***

### valueType

> `readonly` **valueType**: `string`

Defined in: src/compliance/pdfA4.ts:38

XMP value type (e.g. 'Text', 'Integer', 'Boolean').
