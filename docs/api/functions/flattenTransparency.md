[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenTransparency

# Function: flattenTransparency()

> **flattenTransparency**(`pdfBytes`): `Uint8Array`

Defined in: [src/compliance/transparencyFlattener.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/compliance/transparencyFlattener.ts#L143)

Flatten transparency by modifying PDF bytes.

This replaces:
- `/CA <value>` with `/CA 1` (where value < 1)
- `/ca <value>` with `/ca 1` (where value < 1)
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
