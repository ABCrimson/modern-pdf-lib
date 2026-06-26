[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / cropPage

# Function: cropPage()

```ts
function cropPage(
   doc, 
   index, 
   cropBox): void;
```

Defined in: [src/core/pageManipulation.ts:274](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pageManipulation.ts#L274)

Set a crop box on a page.

The crop box defines the visible region of the page when displayed
or printed. It defaults to the media box if not set.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### index

`number`

Zero-based index of the page.

### cropBox

[`CropBox`](../interfaces/CropBox.md)

The crop box rectangle.

## Returns

`void`

## Throws

RangeError if the index is out of bounds.

## Example

```ts
cropPage(doc, 0, { x: 50, y: 50, width: 495, height: 742 });
```
