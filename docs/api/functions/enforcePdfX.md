[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / enforcePdfX

# Function: enforcePdfX()

```ts
function enforcePdfX(pdfBytes, options): Uint8Array;
```

Defined in: [src/compliance/pdfxCompliance.ts:439](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfxCompliance.ts#L439)

Attempt to make a PDF conform to a PDF/X level.

This adds or corrects:
- Output intent with the specified configuration
- /Trapped key in the Info dictionary
- TrimBox = CropBox (or MediaBox) if missing
- Flattens transparency for X-1a and X-3

**Limitations:**
- Cannot convert RGB to CMYK (for X-1a — validation will still fail)
- Cannot embed fonts that are not already embedded
- Cannot remove encryption (throws an error)
- Cannot remove JavaScript (throws an error)

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### options

`PdfXOptions`

PDF/X enforcement options.

## Returns

`Uint8Array`

The modified PDF bytes.
