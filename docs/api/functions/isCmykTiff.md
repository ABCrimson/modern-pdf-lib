[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isCmykTiff

# Function: isCmykTiff()

> **isCmykTiff**(`ifdEntries`): `boolean`

Defined in: [src/assets/image/tiffCmyk.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffCmyk.ts#L154)

Detect whether a TIFF image uses CMYK color space by inspecting IFD entries.

A TIFF is considered CMYK when:
- PhotometricInterpretation (tag 262) has value 5 (Separated), AND
- If InkSet (tag 332) is present, its value must be 1 (CMYK inks)

If InkSet is not present but PhotometricInterpretation is 5, the image
is assumed to be CMYK (per the TIFF specification default).

## Parameters

### ifdEntries

`object`[]

Array of IFD entries with tag and value fields.

## Returns

`boolean`

`true` if the TIFF uses CMYK color space.
