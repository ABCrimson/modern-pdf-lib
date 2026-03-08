[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IccProfile

# Interface: IccProfile

Defined in: [src/assets/image/iccProfile.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/iccProfile.ts#L32)

Represents an extracted ICC color profile.

## Properties

### colorSpace

> `readonly` **colorSpace**: `string`

Defined in: [src/assets/image/iccProfile.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/iccProfile.ts#L38)

ICC color space signature (e.g. 'RGB ', 'CMYK', 'GRAY').

***

### components

> `readonly` **components**: `number`

Defined in: [src/assets/image/iccProfile.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/iccProfile.ts#L36)

Number of color components (1 = gray, 3 = RGB, 4 = CMYK).

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/assets/image/iccProfile.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/iccProfile.ts#L34)

Raw ICC profile data bytes.

***

### description

> `readonly` **description**: `string` \| `undefined`

Defined in: [src/assets/image/iccProfile.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/iccProfile.ts#L40)

Human-readable profile description from the 'desc' tag, if present.
