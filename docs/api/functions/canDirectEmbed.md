[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / canDirectEmbed

# Function: canDirectEmbed()

> **canDirectEmbed**(`data`): `boolean`

Defined in: [src/assets/image/tiffDirectEmbed.ts:338](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L338)

Check whether a TIFF file can be directly embedded in PDF without
a full decode-re-encode cycle.

Direct embedding is supported for:
- Uncompressed TIFFs (compression = 1)
- Deflate-compressed TIFFs (compression = 8 or 32946)
- JPEG-in-TIFF (compression = 7 or 6)

## Parameters

### data

`Uint8Array`

Raw TIFF file bytes.

## Returns

`boolean`

`true` if the TIFF can be directly embedded.
