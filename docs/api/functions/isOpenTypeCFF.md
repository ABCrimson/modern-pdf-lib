[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isOpenTypeCFF

# Function: isOpenTypeCFF()

> **isOpenTypeCFF**(`data`): `boolean`

Defined in: [src/assets/font/otfDetect.ts:19](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/assets/font/otfDetect.ts#L19)

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
