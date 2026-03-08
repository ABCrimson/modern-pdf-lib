[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / cropPage

# Function: cropPage()

> **cropPage**(`doc`, `index`, `cropBox`): `void`

Defined in: [src/core/pageManipulation.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pageManipulation.ts#L280)

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
