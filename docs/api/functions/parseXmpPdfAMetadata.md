[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseXmpPdfAMetadata

# Function: parseXmpPdfAMetadata()

> **parseXmpPdfAMetadata**(`xmp`): [`ParsedXmpMetadata`](../interfaces/ParsedXmpMetadata.md)

Defined in: [src/compliance/xmpValidator.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/compliance/xmpValidator.ts#L86)

Parse an XMP metadata string into structured data.

Uses lightweight regex-based extraction (no XML parser needed).
Missing properties are returned as `undefined`.

## Parameters

### xmp

`string`

The raw XMP XML string.

## Returns

[`ParsedXmpMetadata`](../interfaces/ParsedXmpMetadata.md)

Parsed metadata fields.
