[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Type1Halftone

# Interface: Type1Halftone

Defined in: src/core/halftone.ts:76

Parameters for a Type 1 (spot-function) halftone.

## Properties

### accurateScreens?

> `readonly` `optional` **accurateScreens?**: `boolean`

Defined in: src/core/halftone.ts:90

When `true`, request the more accurate (but slower) screening
algorithm via `/AccurateScreens true`.

***

### angle

> `readonly` **angle**: `number`

Defined in: src/core/halftone.ts:80

Screen angle in degrees, measured counter-clockwise.

***

### frequency

> `readonly` **frequency**: `number`

Defined in: src/core/halftone.ts:78

Screen frequency in halftone cells per inch.

***

### spotFunction

> `readonly` **spotFunction**: `string`

Defined in: src/core/halftone.ts:85

The spot function — typically one of [STANDARD\_SPOT\_FUNCTIONS](../variables/STANDARD_SPOT_FUNCTIONS.md).
Emitted as a PDF name `/SpotFunction`.
