[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextAppearanceOptions

# Interface: TextAppearanceOptions

Defined in: [src/form/fieldAppearance.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L74)

Options for generating a text field appearance.

## Properties

### alignment?

> `optional` **alignment**: `number`

Defined in: [src/form/fieldAppearance.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L84)

Text alignment: 0=left, 1=center, 2=right. Default: 0.

***

### borderWidth?

> `optional` **borderWidth**: `number`

Defined in: [src/form/fieldAppearance.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L88)

Border width in points. Default: 1.

***

### fontName?

> `optional` **fontName**: `string`

Defined in: [src/form/fieldAppearance.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L80)

Font name to use (e.g. "Helv"). Default: "Helv".

***

### fontSize?

> `optional` **fontSize**: `number`

Defined in: [src/form/fieldAppearance.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L82)

Font size in points. 0 means auto-size. Default: 0.

***

### multiline?

> `optional` **multiline**: `boolean`

Defined in: [src/form/fieldAppearance.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L86)

Whether the field is multiline. Default: false.

***

### rect

> **rect**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/form/fieldAppearance.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L78)

The widget rectangle [x1, y1, x2, y2].

***

### value

> **value**: `string`

Defined in: [src/form/fieldAppearance.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L76)

The text value to render.
