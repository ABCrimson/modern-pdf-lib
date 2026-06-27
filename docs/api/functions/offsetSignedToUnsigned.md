[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / offsetSignedToUnsigned

# Function: offsetSignedToUnsigned()

```ts
function offsetSignedToUnsigned(data, bitsPerComponent): Uint8Array;
```

Defined in: [src/parser/jpeg2000BitDepth.ts:341](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000BitDepth.ts#L341)

Offset signed component samples to unsigned range.

For signed data with `N` bits, the offset is `2^(N-1)`.  For example,
a signed 16-bit value of −32768 becomes 0 and +32767 becomes 65535.

## Parameters

### data

`Uint8Array`

Source sample bytes (big-endian for &gt;8 bits).

### bitsPerComponent

`number`

Component bit depth.

## Returns

`Uint8Array`

A new `Uint8Array` with the offset applied.
