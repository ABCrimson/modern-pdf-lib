[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseXmpMetadata

# Function: parseXmpMetadata()

```ts
function parseXmpMetadata(xmpString): Partial<DocumentMetadata>;
```

Defined in: [src/metadata/xmpMetadata.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/metadata/xmpMetadata.ts#L203)

Parse XMP metadata XML string into document metadata fields.

This is a lightweight regex-based parser that handles the standard
XMP properties used in PDF files.  It does not require a full XML
parser, keeping the library dependency-free.

## Parameters

### xmpString

`string`

The raw XMP XML string.

## Returns

`Partial`\&lt;[`DocumentMetadata`](../interfaces/DocumentMetadata.md)\&gt;

Partial document metadata extracted from the XMP.
