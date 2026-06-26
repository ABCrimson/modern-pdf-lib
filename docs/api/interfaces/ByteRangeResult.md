[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ByteRangeResult

# Interface: ByteRangeResult

Defined in: [src/signature/byteRange.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L35)

Result of ByteRange computation for a prepared PDF.

## Properties

### byteRange

```ts
byteRange: [number, number, number, number];
```

Defined in: [src/signature/byteRange.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L37)

The byte range array [offset1, length1, offset2, length2].

***

### contentsLength

```ts
contentsLength: number;
```

Defined in: [src/signature/byteRange.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L41)

Length of the placeholder in bytes (including angle brackets `<…>`).

***

### contentsOffset

```ts
contentsOffset: number;
```

Defined in: [src/signature/byteRange.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/byteRange.ts#L39)

Start offset of the /Contents hex string placeholder (the `<`).
