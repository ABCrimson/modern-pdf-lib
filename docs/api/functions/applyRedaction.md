[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyRedaction

# Function: applyRedaction()

```ts
function applyRedaction(
   doc, 
   pageIndex, 
   annotIndex): RedactionResult;
```

Defined in: [src/annotation/applyRedactions.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L249)

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
