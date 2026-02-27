[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateTextAppearance

# Function: generateTextAppearance()

> **generateTextAppearance**(`options`): [`PdfStream`](../classes/PdfStream.md)

Defined in: [src/form/fieldAppearance.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/form/fieldAppearance.ts#L98)

Generate the appearance stream for a text field.

The stream renders the text value within the widget rectangle,
using Tf/Td/Tj operators. Handles single-line and multiline,
alignment (quadding), and auto font-size calculation.

## Parameters

### options

[`TextAppearanceOptions`](../interfaces/TextAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
