[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateCheckboxAppearance

# Function: generateCheckboxAppearance()

```ts
function generateCheckboxAppearance(options): PdfStream;
```

Defined in: [src/form/fieldAppearance.ts:210](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldAppearance.ts#L210)

Generate the appearance stream for a checkbox — checked state.

Renders a checkmark (a simple cross/tick path) inside the widget
rectangle when checked, or an empty box when unchecked.

## Parameters

### options

[`CheckboxAppearanceOptions`](../interfaces/CheckboxAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
