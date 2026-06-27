[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getPageSize

# Function: getPageSize()

```ts
function getPageSize(doc, index): object;
```

Defined in: [src/core/pageManipulation.ts:297](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pageManipulation.ts#L297)

Get the size of a page.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument.

### index

`number`

Zero-based page index.

## Returns

`object`

A `{ width, height }` object in PDF points.

### height

```ts
height: number;
```

### width

```ts
width: number;
```
