[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateCheckboxAppearance

# Function: generateCheckboxAppearance()

```ts
function generateCheckboxAppearance(options): PdfStream;
```

Defined in: [src/form/fieldAppearance.ts:210](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/fieldAppearance.ts#L210)

Generate the appearance stream for a checkbox — checked state.

Renders a checkmark (a simple cross/tick path) inside the widget
rectangle when checked, or an empty box when unchecked.

## Parameters

### options

[`CheckboxAppearanceOptions`](../interfaces/CheckboxAppearanceOptions.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
