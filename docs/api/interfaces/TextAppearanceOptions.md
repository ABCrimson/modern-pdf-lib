[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextAppearanceOptions

# Interface: TextAppearanceOptions

Defined in: [src/form/fieldAppearance.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L73)

Options for generating a text field appearance.

## Properties

### alignment?

> `optional` **alignment?**: `number`

Defined in: [src/form/fieldAppearance.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L83)

Text alignment: 0=left, 1=center, 2=right. Default: 0.

***

### borderWidth?

> `optional` **borderWidth?**: `number`

Defined in: [src/form/fieldAppearance.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L87)

Border width in points. Default: 1.

***

### fontName?

> `optional` **fontName?**: `string`

Defined in: [src/form/fieldAppearance.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L79)

Font name to use (e.g. "Helv"). Default: "Helv".

***

### fontSize?

> `optional` **fontSize?**: `number`

Defined in: [src/form/fieldAppearance.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L81)

Font size in points. 0 means auto-size. Default: 0.

***

### multiline?

> `optional` **multiline?**: `boolean`

Defined in: [src/form/fieldAppearance.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L85)

Whether the field is multiline. Default: false.

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/form/fieldAppearance.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L77)

The widget rectangle [x1, y1, x2, y2].

***

### value

> **value**: `string`

Defined in: [src/form/fieldAppearance.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/fieldAppearance.ts#L75)

The text value to render.
