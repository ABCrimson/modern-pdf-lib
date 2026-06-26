[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateSignatureAppearance

# Function: generateSignatureAppearance()

```ts
function generateSignatureAppearance(options): PdfStream;
```

Defined in: [src/form/fieldAppearance.ts:475](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fieldAppearance.ts#L475)

Generate the appearance stream for a signature field.

Unsigned: dashed border rectangle.
Signed: "Signed" text with a line through it.

## Parameters

### options

[`SignatureAppearanceOptions`](../interfaces/SignatureAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
