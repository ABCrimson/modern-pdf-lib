[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / rotatePage

# Function: rotatePage()

> **rotatePage**(`doc`, `index`, `angle`): `void`

Defined in: [src/core/pageManipulation.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pageManipulation.ts#L246)

Rotate a page by the specified angle.

The angle is cumulative with any existing rotation set on the page.
The page's `/Rotate` entry in the page dictionary will be set when
the document is saved.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### index

`number`

Zero-based index of the page to rotate.

### angle

`number`

Rotation angle in degrees. Must be a multiple of 90.
              Common values: 90, 180, 270, -90.

## Returns

`void`

## Throws

RangeError if the index is out of bounds.

## Throws

Error if the angle is not a multiple of 90.

## Example

```ts
rotatePage(doc, 0, 90); // Rotate first page 90 degrees clockwise
```
