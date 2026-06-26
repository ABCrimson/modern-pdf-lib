[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / nameHalftone

# Function: nameHalftone()

```ts
function nameHalftone(halftone, name?): PdfDict;
```

Defined in: [src/core/halftone.ts:218](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/halftone.ts#L218)

Build a graphics-state-ready halftone reference dictionary fragment
pairing a halftone with an optional `/HalftoneName`.

Emits the supplied halftone unchanged when `name` is omitted; otherwise
sets `/HalftoneName` (a literal string) on it and returns it. This is a
convenience for naming a halftone for caching by conforming readers.

## Parameters

### halftone

[`PdfDict`](../classes/PdfDict.md)

### name?

`string`

## Returns

[`PdfDict`](../classes/PdfDict.md)
