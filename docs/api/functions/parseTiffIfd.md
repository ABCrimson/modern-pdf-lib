[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseTiffIfd

# Function: parseTiffIfd()

```ts
function parseTiffIfd(
   data, 
   offset, 
   littleEndian): IfdEntry[];
```

Defined in: [src/assets/image/tiffDecode.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L155)

Parse a single IFD from TIFF data.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

### offset

`number`

Byte offset to the IFD.

### littleEndian

`boolean`

Whether the TIFF uses little-endian byte order.

## Returns

[`IfdEntry`](../interfaces/IfdEntry.md)[]

Array of IFD entries.
