[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildSampledTransferFunction

# Function: buildSampledTransferFunction()

> **buildSampledTransferFunction**(`samples`): [`PdfStream`](../classes/PdfStream.md)

Defined in: src/core/halftone.ts:197

Build a sampled (Type 0) transfer-function stream from a lookup table.

Emits a stream with `/FunctionType 0`, `/Domain [0 1]`, `/Range [0 1]`,
`/Size [n]`, and `/BitsPerSample 8`; the body is the raw `samples`
array (one byte per sample, mapping input 0..1 to output 0..1).

## Parameters

### samples

`Uint8Array`

8-bit output samples spanning the input domain `[0, 1]`.

## Returns

[`PdfStream`](../classes/PdfStream.md)
