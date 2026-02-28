[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawImageXObject

# Function: drawImageXObject()

> **drawImageXObject**(`name`, `x`, `y`, `width`, `height`): `string`

Defined in: [src/core/operators/image.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/operators/image.ts#L59)

Produce the full operator sequence to draw an image XObject at the
given position and dimensions.

This emits:
1. `q`  — save graphics state
2. `cm` — transformation matrix that maps the image's unit square
   to the rectangle `(x, y, width, height)`
3. `Do` — paint the XObject
4. `Q`  — restore graphics state

## Parameters

### name

`string`

Resource name of the XObject (e.g. `Im1`).

### x

`number`

Lower-left x coordinate of the image on the page.

### y

`number`

Lower-left y coordinate of the image on the page.

### width

`number`

Rendered width of the image.

### height

`number`

Rendered height of the image.

## Returns

`string`
