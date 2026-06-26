[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / renderMultiPageTable

# Function: renderMultiPageTable()

```ts
function renderMultiPageTable(options, bottomMargin?): MultiPageTableResult;
```

Defined in: [src/layout/table.ts:810](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/table.ts#L810)

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
