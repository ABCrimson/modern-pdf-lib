[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutColumns

# Function: layoutColumns()

```ts
function layoutColumns(
   spans, 
   frame, 
   columnOptions, 
   paragraphOptions?, 
   measureFn?): TextLayoutResult;
```

Defined in: [src/layout/textLayout.ts:887](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/textLayout.ts#L887)

Lay out text across multiple columns within a frame.

Divides the frame into equal-width columns separated by gaps,
then flows text sequentially through each column. Optionally
draws column rules (vertical lines between columns) and balances
column heights.

## Parameters

### spans

`string` \| `TextSpan`[]

The text content.

### frame

`TextFrame`

The outer frame containing all columns.

### columnOptions

`MultiColumnOptions`

Number of columns, gap, rule, balancing.

### paragraphOptions?

`ParagraphOptions`

Paragraph-level options.

### measureFn?

(`text`, `font`, `size`) =&gt; `number`

Optional text measurement function.

## Returns

`TextLayoutResult`

A combined TextLayoutResult.
