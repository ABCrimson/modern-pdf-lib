[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / linearizePdf

# Function: linearizePdf()

```ts
function linearizePdf(pdfBytes, options?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/core/linearization.ts:989](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/linearization.ts#L989)

Linearize a PDF document for fast web viewing.

This reorganizes the PDF so that:
1. A linearization parameter dictionary appears first (§F.2)
2. Objects needed for the first page appear early in the file
3. A primary hint stream describes page offsets and shared objects (§F.4)
4. Cross-reference streams are used for all xref data (§7.5.8)

Uses two-pass serialization:
- Pass 1 produces a trial layout to determine exact byte sizes.
- Pass 2 re-serializes with the correct values, so all offsets
  (/L, /O, /E, /T, /H, hint table entries, xref entries) are exact.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### options?

[`LinearizationOptions`](../interfaces/LinearizationOptions.md)

Linearization options.

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The linearized PDF bytes.
