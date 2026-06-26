[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeWoff

# Function: decodeWoff()

> **decodeWoff**(`data`): `Uint8Array`

Defined in: src/assets/font/woff.ts:175

Decode a WOFF1 container into the raw sfnt (TrueType / OpenType) font.

Each table's data is zlib-inflated when its compressed length differs
from its original length, or copied verbatim otherwise. The output is a
standard sfnt: a 12-byte offset table, 16-byte table records sorted by
tag, and 4-byte-aligned table data.

## Parameters

### data

`Uint8Array`

The WOFF1 (or WOFF2) container bytes.

## Returns

`Uint8Array`

The reconstructed raw sfnt bytes.

## Throws

`'WOFF2 decode not yet supported'` for WOFF2 input, or a
        descriptive error when a WOFF1 container is malformed.
