[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Type1Halftone

# Interface: Type1Halftone

Defined in: [src/core/halftone.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L76)

Parameters for a Type 1 (spot-function) halftone.

## Properties

### accurateScreens?

```ts
readonly optional accurateScreens?: boolean;
```

Defined in: [src/core/halftone.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L90)

When `true`, request the more accurate (but slower) screening
algorithm via `/AccurateScreens true`.

***

### angle

```ts
readonly angle: number;
```

Defined in: [src/core/halftone.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L80)

Screen angle in degrees, measured counter-clockwise.

***

### frequency

```ts
readonly frequency: number;
```

Defined in: [src/core/halftone.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L78)

Screen frequency in halftone cells per inch.

***

### spotFunction

```ts
readonly spotFunction: string;
```

Defined in: [src/core/halftone.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L85)

The spot function — typically one of [STANDARD\_SPOT\_FUNCTIONS](../variables/STANDARD_SPOT_FUNCTIONS.md).
Emitted as a PDF name `/SpotFunction`.
