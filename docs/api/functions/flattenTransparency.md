[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenTransparency

# Function: flattenTransparency()

```ts
function flattenTransparency(pdfBytes): Uint8Array;
```

Defined in: [src/compliance/transparencyFlattener.ts:150](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L150)

Flatten transparency by modifying PDF bytes.

This replaces:
- `/CA <value>` with `/CA 1` (where value &lt; 1)
- `/ca <value>` with `/ca 1` (where value &lt; 1)
- `/SMask <ref>` with `/SMask /None`
- `/BM /<mode>` with `/BM /Normal`

**Note:** This is a "lossy" operation — semi-transparent elements
will become fully opaque. For print-quality output, manual review
is recommended.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

## Returns

`Uint8Array`

Modified PDF bytes with transparency removed.
