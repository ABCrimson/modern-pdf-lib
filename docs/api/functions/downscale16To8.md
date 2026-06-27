[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / downscale16To8

# Function: downscale16To8()

```ts
function downscale16To8(data, bitsPerComponent): Uint8Array;
```

Defined in: [src/parser/jpeg2000BitDepth.ts:214](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000BitDepth.ts#L214)

Downscale component data from a higher bit depth (&gt;8) to 8-bit.

Uses linear scaling: `out = round(value * 255 / maxValue)`.
For signed components, the values are first offset by `2^(bits-1)` to
produce unsigned values in the range `[0, 2^bits - 1]`.

## Parameters

### data

`Uint8Array`

Source samples.  For depths &lt;= 8, each sample occupies
  one byte.  For depths 9–16, each sample occupies two bytes (big-endian).

### bitsPerComponent

`number`

The source bit depth (must be &gt; 8, up to 16).

## Returns

`Uint8Array`

A new `Uint8Array` with one byte per sample, scaled to [0, 255].
