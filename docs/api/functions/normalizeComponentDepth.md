[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / normalizeComponentDepth

# Function: normalizeComponentDepth()

```ts
function normalizeComponentDepth(
   data, 
   fromBits, 
   toBits): Uint8Array;
```

Defined in: [src/parser/jpeg2000BitDepth.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000BitDepth.ts#L282)

Generic bit-depth normalizer.  Converts component sample data from an
arbitrary source depth to an arbitrary target depth.

Handles signed source data by offsetting before scaling.  The output is
always unsigned.

Supports depths from 1 to 16.  Source data is expected in big-endian
byte order when the depth exceeds 8 bits (2 bytes per sample).  Output
follows the same convention.

## Parameters

### data

`Uint8Array`

Source sample bytes.

### fromBits

`number`

Source bit depth (1–16).

### toBits

`number`

Target bit depth (1–16).

## Returns

`Uint8Array`

A new `Uint8Array` with samples at the target depth.
