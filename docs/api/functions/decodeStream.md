[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeStream

# Function: decodeStream()

> **decodeStream**(`data`, `filters`, `decodeParms?`): `Uint8Array`

Defined in: [src/parser/streamDecode.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamDecode.ts#L37)

Decode (decompress) PDF stream data that may have one or more filters
applied.  Filters are applied in the order they appear in the array
(first entry is the outermost encoding, decoded first).

## Parameters

### data

`Uint8Array`

The raw (encoded) stream bytes.

### filters

`string` \| `string`[]

A single filter name or an ordered array of filter
                     names (e.g. `"FlateDecode"` or
                     `["ASCIIHexDecode", "FlateDecode"]`).

### decodeParms?

[`PdfDict`](../classes/PdfDict.md) \| [`PdfDict`](../classes/PdfDict.md)[] \| `null`

Optional decode parameters — a single `PdfDict` or
                     an array of `PdfDict | null` parallel to `filters`.

## Returns

`Uint8Array`

The fully decoded bytes.
