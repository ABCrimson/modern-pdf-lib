[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StripResult

# Interface: StripResult

Defined in: [src/compliance/stripProhibited.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/stripProhibited.ts#L25)

Result returned by [stripProhibitedFeatures](../functions/stripProhibitedFeatures.md).

## Properties

### bytes

> `readonly` **bytes**: `Uint8Array`

Defined in: [src/compliance/stripProhibited.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/stripProhibited.ts#L27)

Modified PDF bytes.

***

### modified

> `readonly` **modified**: `boolean`

Defined in: [src/compliance/stripProhibited.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/stripProhibited.ts#L31)

Whether any modifications were made.

***

### stripped

> `readonly` **stripped**: [`StrippedFeature`](StrippedFeature.md)[]

Defined in: [src/compliance/stripProhibited.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/stripProhibited.ts#L29)

Features that were stripped.
