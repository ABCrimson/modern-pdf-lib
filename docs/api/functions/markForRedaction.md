[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / markForRedaction

# Function: markForRedaction()

```ts
function markForRedaction(page, options): void;
```

Defined in: [src/core/redaction.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L96)

Mark a rectangular region on a page for redaction.

This does not immediately modify the page.  Call
[applyRedactions](applyRedactions.md) to draw the redaction rectangles.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The page to mark.

### options

[`RedactionOptions`](../interfaces/RedactionOptions.md)

The redaction options.

## Returns

`void`
