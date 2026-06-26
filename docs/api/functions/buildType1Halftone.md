[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildType1Halftone

# Function: buildType1Halftone()

```ts
function buildType1Halftone(p): PdfDict;
```

Defined in: [src/core/halftone.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L100)

Build a Type 1 halftone dictionary.

Emits `/Type /Halftone /HalftoneType 1` with numeric `/Frequency` and
`/Angle`, a `/SpotFunction` name, and an optional `/AccurateScreens`
boolean.

## Parameters

### p

[`Type1Halftone`](../interfaces/Type1Halftone.md)

## Returns

[`PdfDict`](../classes/PdfDict.md)
