[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LinearizationInfo

# Interface: LinearizationInfo

Defined in: [src/core/linearization.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L52)

Information extracted from a linearization parameter dictionary.
Maps to the entries defined in PDF spec §F.2.

## Properties

### firstPageOffset

> **firstPageOffset**: `number`

Defined in: [src/core/linearization.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L62)

Byte offset of the end of the first page section (/E).

***

### length

> **length**: `number`

Defined in: [src/core/linearization.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L56)

File length (/L).

***

### pageCount

> **pageCount**: `number`

Defined in: [src/core/linearization.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L60)

Total page count (/N).

***

### primaryPage

> **primaryPage**: `number`

Defined in: [src/core/linearization.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L58)

Object number of the first page's page object (/O).

***

### version

> **version**: `number`

Defined in: [src/core/linearization.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/linearization.ts#L54)

Linearization version (e.g. 1.0).
