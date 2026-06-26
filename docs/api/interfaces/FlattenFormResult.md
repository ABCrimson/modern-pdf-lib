[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FlattenFormResult

# Interface: FlattenFormResult

Defined in: [src/form/formFlatten.ts:1053](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/formFlatten.ts#L1053)

Result of a form flatten operation.

Contains the content stream operators and XObject resources that
must be applied to the page(s) to complete the flattening.

## Properties

### acroFormRemoved

> **acroFormRemoved**: `boolean`

Defined in: [src/form/formFlatten.ts:1063](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/formFlatten.ts#L1063)

Whether the AcroForm was fully removed (all fields flattened).

***

### contentOps

> **contentOps**: `string`

Defined in: [src/form/formFlatten.ts:1055](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/formFlatten.ts#L1055)

Content stream operators to append to the page.

***

### flattenedFields

> **flattenedFields**: `string`[]

Defined in: [src/form/formFlatten.ts:1059](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/formFlatten.ts#L1059)

Names of fields that were flattened.

***

### skippedFields

> **skippedFields**: `string`[]

Defined in: [src/form/formFlatten.ts:1061](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/formFlatten.ts#L1061)

Names of fields that were skipped (e.g. read-only with preserveReadOnly).

***

### xObjects

> **xObjects**: `object`[]

Defined in: [src/form/formFlatten.ts:1057](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/formFlatten.ts#L1057)

XObject name-to-stream pairs to add to page resources.

#### name

> **name**: `string`

#### stream

> **stream**: [`PdfStream`](../classes/PdfStream.md)
