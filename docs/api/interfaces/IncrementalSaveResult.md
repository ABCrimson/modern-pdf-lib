[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalSaveResult

# Interface: IncrementalSaveResult

Defined in: [src/core/incrementalWriter.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L41)

Result of an incremental save operation.

## Properties

### bytes

> `readonly` **bytes**: `Uint8Array`

Defined in: [src/core/incrementalWriter.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L43)

The complete PDF file bytes (original + appended data).

***

### newXrefOffset

> `readonly` **newXrefOffset**: `number`

Defined in: [src/core/incrementalWriter.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/incrementalWriter.ts#L46)

Byte offset of the new xref section in the output.
