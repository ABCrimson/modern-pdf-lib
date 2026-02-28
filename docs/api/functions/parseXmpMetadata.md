[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseXmpMetadata

# Function: parseXmpMetadata()

> **parseXmpMetadata**(`xmpString`): `Partial`\<[`DocumentMetadata`](../interfaces/DocumentMetadata.md)\>

Defined in: [src/metadata/xmpMetadata.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/metadata/xmpMetadata.ts#L203)

Parse XMP metadata XML string into document metadata fields.

This is a lightweight regex-based parser that handles the standard
XMP properties used in PDF files.  It does not require a full XML
parser, keeping the library dependency-free.

## Parameters

### xmpString

`string`

The raw XMP XML string.

## Returns

`Partial`\<[`DocumentMetadata`](../interfaces/DocumentMetadata.md)\>

Partial document metadata extracted from the XMP.
