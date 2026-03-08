[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeStream

# Function: decodeStream()

> **decodeStream**(`data`, `filters`, `decodeParms?`): `Uint8Array`

Defined in: [src/parser/streamDecode.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/parser/streamDecode.ts#L37)

Decode (decompress) PDF stream data that may have one or more filters
applied.  Filters are applied in the order they appear in the array
(first entry is the outermost encoding, decoded first).

## Parameters

### data

`Uint8Array`

The raw (encoded) stream bytes.

### filters

A single filter name or an ordered array of filter
                     names (e.g. `"FlateDecode"` or
                     `["ASCIIHexDecode", "FlateDecode"]`).

`string` | `string`[]

### decodeParms?

Optional decode parameters — a single `PdfDict` or
                     an array of `PdfDict | null` parallel to `filters`.

[`PdfDict`](../classes/PdfDict.md) | [`PdfDict`](../classes/PdfDict.md)[] | `null`

## Returns

`Uint8Array`

The fully decoded bytes.
