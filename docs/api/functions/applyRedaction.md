[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyRedaction

# Function: applyRedaction()

> **applyRedaction**(`doc`, `pageIndex`, `annotIndex`): [`RedactionResult`](../interfaces/RedactionResult.md)

Defined in: src/annotation/applyRedactions.ts:197

Apply a single redaction annotation identified by page and annotation
index.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PDF document.

### pageIndex

`number`

Zero-based page index.

### annotIndex

`number`

Zero-based annotation index within the page.

## Returns

[`RedactionResult`](../interfaces/RedactionResult.md)

A [RedactionResult](../interfaces/RedactionResult.md) (appliedCount 0 or 1).

## Throws

RangeError if pageIndex or annotIndex is out of bounds.

## Throws

TypeError if the annotation at annotIndex is not a
                   /Redact annotation.
