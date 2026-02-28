[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawXObject

# Function: drawXObject()

> **drawXObject**(`name`): `string`

Defined in: [src/core/operators/image.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/operators/image.ts#L37)

Invoke a named XObject (`Do`).

The XObject must be listed in the page's `/Resources /XObject` dictionary
under `name`.  The leading slash is added automatically if absent.

This is the fundamental operator for placing images on a page.  Callers
should first set up the transformation matrix (via `cm`) so that the
unit square `[0,0]–[1,1]` maps to the desired page rectangle.

## Parameters

### name

`string`

Resource name (e.g. `Im1` or `/Im1`).

## Returns

`string`
