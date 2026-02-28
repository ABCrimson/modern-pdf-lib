[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / markForRedaction

# Function: markForRedaction()

> **markForRedaction**(`page`, `options`): `void`

Defined in: [src/core/redaction.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/redaction.ts#L75)

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
