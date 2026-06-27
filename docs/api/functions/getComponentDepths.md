[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getComponentDepths

# Function: getComponentDepths()

```ts
function getComponentDepths(sizMarker): ComponentDepth[];
```

Defined in: [src/parser/jpeg2000BitDepth.ts:149](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000BitDepth.ts#L149)

Parse the SIZ marker to extract per-component bit depth information.

The SIZ marker segment stores the component count followed by one byte
per component describing its bit depth and signedness:

- Bits 0–6: depth minus one (i.e. value 7 means 8 bits)
- Bit 7: 1 = signed, 0 = unsigned

## Parameters

### sizMarker

`Uint8Array`

A `Uint8Array` containing at least the SIZ marker
  segment.  May be a full JP2/J2K codestream — the SIZ is located
  automatically.

## Returns

`ComponentDepth`[]

An array of per-component depth descriptors.

## Throws

If the SIZ marker cannot be found or is truncated.
