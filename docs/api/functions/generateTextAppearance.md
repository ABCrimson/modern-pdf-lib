[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateTextAppearance

# Function: generateTextAppearance()

```ts
function generateTextAppearance(options): PdfStream;
```

Defined in: [src/form/fieldAppearance.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fieldAppearance.ts#L97)

Generate the appearance stream for a text field.

The stream renders the text value within the widget rectangle,
using Tf/Td/Tj operators. Handles single-line and multiline,
alignment (quadding), and auto font-size calculation.

## Parameters

### options

[`TextAppearanceOptions`](../interfaces/TextAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
