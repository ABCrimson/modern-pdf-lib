[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / markForRedaction

# Function: markForRedaction()

> **markForRedaction**(`page`, `options`): `void`

Defined in: [src/core/redaction.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/redaction.ts#L75)

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
