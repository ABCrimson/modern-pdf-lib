[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseTiffIfd

# Function: parseTiffIfd()

> **parseTiffIfd**(`data`, `offset`, `littleEndian`): [`IfdEntry`](../interfaces/IfdEntry.md)[]

Defined in: [src/assets/image/tiffDecode.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDecode.ts#L155)

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
