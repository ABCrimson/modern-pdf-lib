[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateBoxGeometry

# Function: validateBoxGeometry()

> **validateBoxGeometry**(`box`): `string`[]

Defined in: src/compliance/pdfX6.ts:150

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
