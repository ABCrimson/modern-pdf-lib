[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalSaveResult

# Interface: IncrementalSaveResult

Defined in: [src/core/incrementalWriter.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/incrementalWriter.ts#L45)

Result of an incremental save operation.

## Properties

### bytes

> `readonly` **bytes**: `Uint8Array`

Defined in: [src/core/incrementalWriter.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/incrementalWriter.ts#L47)

The complete PDF file bytes (original + appended data).

***

### newXrefOffset

> `readonly` **newXrefOffset**: `number`

Defined in: [src/core/incrementalWriter.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/incrementalWriter.ts#L50)

Byte offset of the new xref section in the output.
