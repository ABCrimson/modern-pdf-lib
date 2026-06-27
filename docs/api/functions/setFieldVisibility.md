[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setFieldVisibility

# Function: setFieldVisibility()

```ts
function setFieldVisibility(field, visible): void;
```

Defined in: [src/form/fieldVisibility.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldVisibility.ts#L88)

Set the visibility of a form field.

When `visible` is `true`, the Hidden and NoView flags are cleared.
When `visible` is `false`, the Hidden flag is set (the field is
completely hidden — not displayed and not printed).

## Parameters

### field

[`PdfField`](../classes/PdfField.md)

The field to show or hide.

### visible

`boolean`

Whether the field should be visible.

## Returns

`void`
