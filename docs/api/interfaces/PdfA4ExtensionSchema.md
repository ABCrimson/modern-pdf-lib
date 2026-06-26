[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfA4ExtensionSchema

# Interface: PdfA4ExtensionSchema

Defined in: src/compliance/pdfA4.ts:46

Describes a PDF/A extension schema for non-standard XMP namespaces.

## Properties

### namespaceUri

> `readonly` **namespaceUri**: `string`

Defined in: src/compliance/pdfA4.ts:48

Namespace URI of the extended schema.

***

### prefix

> `readonly` **prefix**: `string`

Defined in: src/compliance/pdfA4.ts:50

Preferred namespace prefix.

***

### properties

> `readonly` **properties**: readonly [`PdfA4ExtensionProperty`](PdfA4ExtensionProperty.md)[]

Defined in: src/compliance/pdfA4.ts:54

Properties defined by this schema.

***

### schema

> `readonly` **schema**: `string`

Defined in: src/compliance/pdfA4.ts:52

Human-readable schema name.
