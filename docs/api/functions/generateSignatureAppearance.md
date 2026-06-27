[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateSignatureAppearance

# Function: generateSignatureAppearance()

```ts
function generateSignatureAppearance(options): PdfStream;
```

Defined in: [src/form/fieldAppearance.ts:475](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldAppearance.ts#L475)

Generate the appearance stream for a signature field.

Unsigned: dashed border rectangle.
Signed: "Signed" text with a line through it.

## Parameters

### options

[`SignatureAppearanceOptions`](../interfaces/SignatureAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
