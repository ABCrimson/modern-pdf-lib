[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / upscale8To16

# Function: upscale8To16()

```ts
function upscale8To16(data): Uint8Array;
```

Defined in: [src/parser/jpeg2000BitDepth.ts:254](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000BitDepth.ts#L254)

Upscale 8-bit component data to 16-bit.

Each 8-bit sample is expanded to a 16-bit value using the formula
`out = value * 257` (which maps 0→0 and 255→65535 exactly) and
stored as big-endian two-byte pairs.

## Parameters

### data

`Uint8Array`

Source 8-bit samples.

## Returns

`Uint8Array`

A new `Uint8Array` of length `data.length * 2`, big-endian 16-bit.
