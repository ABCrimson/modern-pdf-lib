[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isOpenTypeCFF

# Function: isOpenTypeCFF()

> **isOpenTypeCFF**(`data`): `boolean`

Defined in: [src/assets/font/otfDetect.ts:19](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/font/otfDetect.ts#L19)

Detect whether font data is an OpenType font with CFF outlines.
CFF-based OpenType fonts start with the ASCII bytes "OTTO".
TrueType-based OpenType fonts start with 0x00010000 or "true".

## Parameters

### data

`Uint8Array`

Raw font file bytes.

## Returns

`boolean`

`true` if the font is a CFF-based OpenType font.
