[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TableColumn

# Interface: TableColumn

Defined in: [src/layout/table.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L86)

Column definition.

## Properties

### align?

> `readonly` `optional` **align**: `"left"` \| `"center"` \| `"right"`

Defined in: [src/layout/table.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L97)

***

### autoFit?

> `readonly` `optional` **autoFit**: `boolean`

Defined in: [src/layout/table.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L94)

Auto-fit: measure content and use minimum needed width.

***

### flex?

> `readonly` `optional` **flex**: `number`

Defined in: [src/layout/table.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L92)

Flex weight (like CSS flex-grow). Default: 1 when no width/percentage.

***

### maxWidth?

> `readonly` `optional` **maxWidth**: `number`

Defined in: [src/layout/table.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L96)

***

### minWidth?

> `readonly` `optional` **minWidth**: `number`

Defined in: [src/layout/table.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L95)

***

### percentage?

> `readonly` `optional` **percentage**: `string`

Defined in: [src/layout/table.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L90)

Percentage of table width (e.g., '30%').

***

### width?

> `readonly` `optional` **width**: `number`

Defined in: [src/layout/table.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/table.ts#L88)

Fixed width in points.
