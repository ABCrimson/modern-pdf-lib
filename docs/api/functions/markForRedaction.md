[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / markForRedaction

# Function: markForRedaction()

> **markForRedaction**(`page`, `options`): `void`

Defined in: [src/core/redaction.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/redaction.ts#L75)

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
