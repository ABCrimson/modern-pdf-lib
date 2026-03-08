[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseTiffIfd

# Function: parseTiffIfd()

> **parseTiffIfd**(`data`, `offset`, `littleEndian`): [`IfdEntry`](../interfaces/IfdEntry.md)[]

Defined in: [src/assets/image/tiffDecode.ts:156](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/tiffDecode.ts#L156)

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
