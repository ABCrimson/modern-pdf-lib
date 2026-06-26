[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureByteRange

# Interface: SignatureByteRange

Defined in: [src/signature/incrementalSave.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L29)

Byte range for an existing signature.

## Properties

### byteRange

```ts
byteRange: [number, number, number, number];
```

Defined in: [src/signature/incrementalSave.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L31)

The four-element byte range array [offset1, length1, offset2, length2].

***

### contentsLength

```ts
contentsLength: number;
```

Defined in: [src/signature/incrementalSave.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L35)

Length of the /Contents hex string (including angle brackets).

***

### contentsOffset

```ts
contentsOffset: number;
```

Defined in: [src/signature/incrementalSave.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L33)

Offset of the /Contents hex string placeholder.
