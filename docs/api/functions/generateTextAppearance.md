[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateTextAppearance

# Function: generateTextAppearance()

> **generateTextAppearance**(`options`): [`PdfStream`](../classes/PdfStream.md)

Defined in: [src/form/fieldAppearance.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L98)

Generate the appearance stream for a text field.

The stream renders the text value within the widget rectangle,
using Tf/Td/Tj operators. Handles single-line and multiline,
alignment (quadding), and auto font-size calculation.

## Parameters

### options

[`TextAppearanceOptions`](../interfaces/TextAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
