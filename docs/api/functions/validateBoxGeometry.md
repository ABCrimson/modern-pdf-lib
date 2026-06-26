[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateBoxGeometry

# Function: validateBoxGeometry()

```ts
function validateBoxGeometry(box): string[];
```

Defined in: [src/compliance/pdfX6.ts:150](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L150)

Validate page-geometry boxes against PDF/X-6 requirements.

Rules enforced (ISO 15930-9, PDF 2.0 §14.11.2):
- A valid MediaBox with positive area is required.
- A TrimBox (or ArtBox; this helper models the TrimBox path) is required.
- The TrimBox must lie within the MediaBox.
- If present, the BleedBox must lie within the MediaBox, and the TrimBox
  must lie within the BleedBox.

## Parameters

### box

[`BoxGeometry`](../interfaces/BoxGeometry.md)

The geometry to validate.

## Returns

`string`[]

An array of human-readable error messages; empty when valid.
