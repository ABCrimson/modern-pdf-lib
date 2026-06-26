[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / HeaderFooterOptions

# Interface: HeaderFooterOptions

Defined in: [src/layout/headerFooter.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L38)

## Properties

### dateFormat?

> `optional` **dateFormat?**: `string`

Defined in: [src/layout/headerFooter.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L50)

Date format string. Default: 'YYYY-MM-DD'

***

### footer?

> `optional` **footer?**: [`HeaderFooterContent`](HeaderFooterContent.md)[]

Defined in: [src/layout/headerFooter.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L40)

***

### header?

> `optional` **header?**: [`HeaderFooterContent`](HeaderFooterContent.md)[]

Defined in: [src/layout/headerFooter.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L39)

***

### margins?

> `optional` **margins?**: `object`

Defined in: [src/layout/headerFooter.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L42)

Margins from page edge in points. Default: { top: 36, bottom: 36, left: 50, right: 50 }

#### bottom?

> `optional` **bottom?**: `number`

#### left?

> `optional` **left?**: `number`

#### right?

> `optional` **right?**: `number`

#### top?

> `optional` **top?**: `number`

***

### pageRange?

> `optional` **pageRange?**: `object`

Defined in: [src/layout/headerFooter.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L46)

Page range to apply to. Default: all pages.

#### end?

> `optional` **end?**: `number`

#### start?

> `optional` **start?**: `number`

***

### separatorLine?

> `optional` **separatorLine?**: `object`

Defined in: [src/layout/headerFooter.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L48)

Separator line between header/footer and content.

#### color?

> `optional` **color?**: [`Color`](../type-aliases/Color.md)

#### dashPattern?

> `optional` **dashPattern?**: `number`[]

#### width?

> `optional` **width?**: `number`

***

### skipFirstPage?

> `optional` **skipFirstPage?**: `boolean`

Defined in: [src/layout/headerFooter.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L44)

Skip first page (e.g. for title page). Default: false
