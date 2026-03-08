[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ByteRangeResult

# Interface: ByteRangeResult

Defined in: [src/signature/byteRange.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/signature/byteRange.ts#L35)

Result of ByteRange computation for a prepared PDF.

## Properties

### byteRange

> **byteRange**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/signature/byteRange.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/signature/byteRange.ts#L37)

The byte range array [offset1, length1, offset2, length2].

***

### contentsLength

> **contentsLength**: `number`

Defined in: [src/signature/byteRange.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/signature/byteRange.ts#L41)

Length of the placeholder in bytes (including angle brackets `<…>`).

***

### contentsOffset

> **contentsOffset**: `number`

Defined in: [src/signature/byteRange.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/signature/byteRange.ts#L39)

Start offset of the /Contents hex string placeholder (the `<`).
