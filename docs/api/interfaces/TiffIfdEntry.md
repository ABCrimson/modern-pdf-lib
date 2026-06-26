[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TiffIfdEntry

# Interface: TiffIfdEntry

Defined in: [src/assets/image/tiffCmyk.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffCmyk.ts#L23)

An IFD entry from a TIFF file, containing a tag number and its value.

## Properties

### tag

> `readonly` **tag**: `number`

Defined in: [src/assets/image/tiffCmyk.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffCmyk.ts#L25)

The TIFF tag number (e.g. 262 for PhotometricInterpretation).

***

### value

> `readonly` **value**: `number`

Defined in: [src/assets/image/tiffCmyk.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffCmyk.ts#L27)

The resolved integer value of the tag.
