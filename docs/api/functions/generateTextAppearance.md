[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateTextAppearance

# Function: generateTextAppearance()

> **generateTextAppearance**(`options`): [`PdfStream`](../classes/PdfStream.md)

Defined in: [src/form/fieldAppearance.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L97)

Generate the appearance stream for a text field.

The stream renders the text value within the widget rectangle,
using Tf/Td/Tj operators. Handles single-line and multiline,
alignment (quadding), and auto font-size calculation.

## Parameters

### options

[`TextAppearanceOptions`](../interfaces/TextAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
