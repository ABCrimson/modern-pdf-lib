[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / renderMultiPageTable

# Function: renderMultiPageTable()

> **renderMultiPageTable**(`options`, `bottomMargin?`): [`MultiPageTableResult`](../interfaces/MultiPageTableResult.md)

Defined in: [src/layout/table.ts:810](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/table.ts#L810)

Render a table across multiple pages, breaking rows when content
would exceed the available vertical space.

Header rows (specified by `options.headerRows`) are repeated at the
top of each new page. Rows are never split across pages.

## Parameters

### options

[`DrawTableOptions`](../interfaces/DrawTableOptions.md)

### bottomMargin?

`number` = `40`

## Returns

[`MultiPageTableResult`](../interfaces/MultiPageTableResult.md)
