[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawTableOptions

# Interface: DrawTableOptions

Defined in: [src/layout/table.ts:101](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L101)

Full table configuration.

## Properties

### alternateRowColors?

> `readonly` `optional` **alternateRowColors**: readonly \[[`Color`](../type-aliases/Color.md), [`Color`](../type-aliases/Color.md)\]

Defined in: [src/layout/table.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L120)

Alternating row background colors [even, odd].

***

### borderColor?

> `readonly` `optional` **borderColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/layout/table.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L112)

***

### borderWidth?

> `readonly` `optional` **borderWidth**: `number`

Defined in: [src/layout/table.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L114)

Border line width in points, default 0.5.

***

### columns?

> `readonly` `optional` **columns**: readonly [`TableColumn`](TableColumn.md)[]

Defined in: [src/layout/table.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L106)

***

### fontName?

> `readonly` `optional` **fontName**: `string`

Defined in: [src/layout/table.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L108)

PDF font resource name, default 'Helvetica'.

***

### fontSize?

> `readonly` `optional` **fontSize**: `number`

Defined in: [src/layout/table.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L110)

Default font size in points, default 12.

***

### headerBackgroundColor?

> `readonly` `optional` **headerBackgroundColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/layout/table.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L122)

Header background color (overrides alternateRowColors for header rows).

***

### headerRows?

> `readonly` `optional` **headerRows**: `number`

Defined in: [src/layout/table.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L116)

Number of header rows (reserved for future page-break support).

***

### headerTextColor?

> `readonly` `optional` **headerTextColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/layout/table.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L124)

Header text color.

***

### padding?

> `readonly` `optional` **padding**: `number`

Defined in: [src/layout/table.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L118)

Default cell padding in points, default 4.

***

### rows

> `readonly` **rows**: readonly [`TableRow`](TableRow.md)[]

Defined in: [src/layout/table.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L105)

***

### textColor?

> `readonly` `optional` **textColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/layout/table.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L111)

***

### width

> `readonly` **width**: `number`

Defined in: [src/layout/table.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L104)

***

### x

> `readonly` **x**: `number`

Defined in: [src/layout/table.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L102)

***

### y

> `readonly` **y**: `number`

Defined in: [src/layout/table.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L103)
