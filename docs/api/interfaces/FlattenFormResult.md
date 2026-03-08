[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FlattenFormResult

# Interface: FlattenFormResult

Defined in: src/form/formFlatten.ts:325

Result of a form flatten operation.

Contains the content stream operators and XObject resources that
must be applied to the page(s) to complete the flattening.

## Properties

### acroFormRemoved

> **acroFormRemoved**: `boolean`

Defined in: src/form/formFlatten.ts:335

Whether the AcroForm was fully removed (all fields flattened).

***

### contentOps

> **contentOps**: `string`

Defined in: src/form/formFlatten.ts:327

Content stream operators to append to the page.

***

### flattenedFields

> **flattenedFields**: `string`[]

Defined in: src/form/formFlatten.ts:331

Names of fields that were flattened.

***

### skippedFields

> **skippedFields**: `string`[]

Defined in: src/form/formFlatten.ts:333

Names of fields that were skipped (e.g. read-only with preserveReadOnly).

***

### xObjects

> **xObjects**: `object`[]

Defined in: src/form/formFlatten.ts:329

XObject name-to-stream pairs to add to page resources.

#### name

> **name**: `string`

#### stream

> **stream**: [`PdfStream`](../classes/PdfStream.md)
