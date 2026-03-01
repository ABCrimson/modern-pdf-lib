[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeStream

# Function: decodeStream()

> **decodeStream**(`data`, `filters`, `decodeParms?`): `Uint8Array`

Defined in: [src/parser/streamDecode.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/parser/streamDecode.ts#L36)

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
