[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseXmpPdfAMetadata

# Function: parseXmpPdfAMetadata()

> **parseXmpPdfAMetadata**(`xmp`): [`ParsedXmpMetadata`](../interfaces/ParsedXmpMetadata.md)

Defined in: [src/compliance/xmpValidator.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/compliance/xmpValidator.ts#L92)

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
