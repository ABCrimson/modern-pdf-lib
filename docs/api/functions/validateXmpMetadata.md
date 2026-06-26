[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateXmpMetadata

# Function: validateXmpMetadata()

> **validateXmpMetadata**(`pdfBytes`, `level`): [`XmpValidationResult`](../interfaces/XmpValidationResult.md)

Defined in: [src/compliance/xmpValidator.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/compliance/xmpValidator.ts#L143)

Validate XMP metadata in a PDF against PDF/A requirements.

Checks that the mandatory PDF/A identification properties exist and
match the expected conformance level.  Also reports warnings for
recommended-but-optional fields (CreatorTool, CreateDate, etc.).

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### level

`string`

The target PDF/A conformance level string (e.g. "1b", "2a").

## Returns

[`XmpValidationResult`](../interfaces/XmpValidationResult.md)

Validation result with issues and parsed metadata.
