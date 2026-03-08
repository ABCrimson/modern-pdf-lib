[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseTiffIfd

# Function: parseTiffIfd()

> **parseTiffIfd**(`data`, `offset`, `littleEndian`): [`IfdEntry`](../interfaces/IfdEntry.md)[]

Defined in: [src/assets/image/tiffDecode.ts:156](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDecode.ts#L156)

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
