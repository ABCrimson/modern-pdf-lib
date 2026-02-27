[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / enforcePdfA

# Function: enforcePdfA()

> **enforcePdfA**(`pdfBytes`, `level`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/compliance/pdfA.ts:316](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/compliance/pdfA.ts#L316)

Attempt to make a PDF conform to PDF/A.

This adds or corrects:
- XMP metadata with PDF/A identification
- File identifier (/ID) in the trailer
- Document language (if missing, defaults to "en")

**Limitations:**
- Cannot embed fonts that are not already embedded
- Cannot remove encryption or JavaScript (throws an error)
- Cannot add structure tree for 'a' conformance
- For full PDF/A conversion, use a dedicated tool

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### level

[`PdfALevel`](../type-aliases/PdfALevel.md)

The target PDF/A conformance level.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The modified PDF bytes.
