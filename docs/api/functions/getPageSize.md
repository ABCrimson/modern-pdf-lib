[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getPageSize

# Function: getPageSize()

```ts
function getPageSize(doc, index): object;
```

Defined in: [src/core/pageManipulation.ts:297](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageManipulation.ts#L297)

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
