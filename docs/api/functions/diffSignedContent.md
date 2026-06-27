[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / diffSignedContent

# Function: diffSignedContent()

```ts
function diffSignedContent(pdf, signatureIndex?): Promise<DocumentDiff>;
```

Defined in: [src/signature/documentDiff.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L258)

Diff the signed content of a PDF against its current state.

Extracts the signed bytes using the ByteRange of a specific signature
(or the latest signature by default), parses both versions, and
compares page count, page content hashes, form field values,
annotation counts, and metadata.

## Parameters

### pdf

`Uint8Array`

The current PDF bytes.

### signatureIndex?

`number`

Zero-based index of the signature to diff against.
                        If not provided, uses the last (most recent) signature.

## Returns

`Promise`\&lt;[`DocumentDiff`](../interfaces/DocumentDiff.md)\&gt;

A DocumentDiff describing all detected changes.

## Example

```ts
import { diffSignedContent } from 'modern-pdf-lib/signature';

const diff = await diffSignedContent(pdfBytes);
if (diff.hasChanges) {
  for (const entry of diff.changes) {
    console.log(`${entry.type}: ${entry.description}`);
  }
}
```
