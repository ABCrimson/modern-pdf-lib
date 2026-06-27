[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseXmpPdfAMetadata

# Function: parseXmpPdfAMetadata()

```ts
function parseXmpPdfAMetadata(xmp): ParsedXmpMetadata;
```

Defined in: [src/compliance/xmpValidator.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpValidator.ts#L92)

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
