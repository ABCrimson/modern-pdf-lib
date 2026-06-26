[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildThresholdHalftone

# Function: buildThresholdHalftone()

> **buildThresholdHalftone**(`halftoneType`, `width`, `height`, `thresholds`): [`PdfStream`](../classes/PdfStream.md)

Defined in: src/core/halftone.ts:127

Build a threshold-array halftone stream (Type 6, 10, or 16).

Emits a stream whose dictionary carries `/Type /Halftone`,
`/HalftoneType` (6, 10, or 16), `/Width`, and `/Height`, and whose body
is the raw threshold data.

For Type 16 the threshold samples are 16-bit; callers must supply two
bytes per sample in big-endian order inside `thresholds`.

## Parameters

### halftoneType

`6` \| `10` \| `16`

### width

`number`

### height

`number`

### thresholds

`Uint8Array`

## Returns

[`PdfStream`](../classes/PdfStream.md)
