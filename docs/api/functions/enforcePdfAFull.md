[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / enforcePdfAFull

# Function: enforcePdfAFull()

> **enforcePdfAFull**(`pdfBytes`, `level`, `options?`): `Promise`\<[`EnforcePdfAResult`](../interfaces/EnforcePdfAResult.md)\>

Defined in: [src/compliance/enforcePdfAv2.ts:220](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/enforcePdfAv2.ts#L220)

Enforce PDF/A compliance with a full pipeline.

Unlike the basic `enforcePdfA()` which only adds XMP metadata and /ID
(and throws on JavaScript), this function actively:

1. **Strips** prohibited features (JavaScript, Launch, Sound, Movie,
   RichMedia) so they no longer cause validation failures.
2. **Flattens** transparency features for PDF/A-1 (sets opacity to 1.0,
   replaces SMask with /None, normalizes blend modes to /Normal).
3. **Adds** XMP metadata with correct `pdfaid:part` and
   `pdfaid:conformance` values.
4. **Adds** a file identifier (`/ID`) to the trailer when missing.
5. **Validates** the result and reports remaining issues.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### level

[`PdfALevel`](../type-aliases/PdfALevel.md)

The target PDF/A conformance level (e.g. '1b', '2b').

### options?

[`EnforcePdfAOptions`](../interfaces/EnforcePdfAOptions.md) = `{}`

Fine-grained control over which steps to execute.

## Returns

`Promise`\<[`EnforcePdfAResult`](../interfaces/EnforcePdfAResult.md)\>

The enforcement result including modified bytes,
                 validation report, and actions taken.

## Throws

If the PDF is encrypted (cannot be fixed automatically).

## Example

```ts
import { enforcePdfAFull } from 'modern-pdf-lib';

const result = await enforcePdfAFull(pdfBytes, '1b', {
  title: 'My Document',
  author: 'Jane Doe',
});

if (result.fullyCompliant) {
  console.log('PDF/A-1b compliant!');
}
```
