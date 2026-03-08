[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TiffIfdEntry

# Interface: TiffIfdEntry

Defined in: [src/assets/image/tiffCmyk.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffCmyk.ts#L23)

An IFD entry from a TIFF file, containing a tag number and its value.

## Properties

### tag

> `readonly` **tag**: `number`

Defined in: [src/assets/image/tiffCmyk.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffCmyk.ts#L25)

The TIFF tag number (e.g. 262 for PhotometricInterpretation).

***

### value

> `readonly` **value**: `number`

Defined in: [src/assets/image/tiffCmyk.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffCmyk.ts#L27)

The resolved integer value of the tag.
