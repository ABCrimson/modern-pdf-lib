[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / labToRgb

# Function: labToRgb()

> **labToRgb**(`L`, `a`, `b`, `whitePoint?`): \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:198

Convert a CIE L*a*b* colour to sRGB (0..1 per channel).

The pipeline is the standard L*a*b* → XYZ → linear-sRGB → gamma-companded
sRGB transform.  XYZ is Bradford-free (a plain scaling by the white point),
matching the ICC `Lab` PCS convention.  The default white point is CIE D50,
which is the white point used by ICC profile connection space and PDF Lab
colour data.

## Parameters

### L

`number`

Lightness, 0..100.

### a

`number`

Green–red component (typically −128..127).

### b

`number`

Blue–yellow component (typically −128..127).

### whitePoint?

readonly \[`number`, `number`, `number`\] = `D50_WHITE_POINT`

Reference white `[Xn Yn Zn]` (Y = 1); defaults to D50.

## Returns

\[`number`, `number`, `number`\]

`[r, g, b]` each in the range 0..1.
