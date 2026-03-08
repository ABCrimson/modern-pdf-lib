[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / drawXObject

# Function: drawXObject()

> **drawXObject**(`name`): `string`

Defined in: [src/core/operators/image.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/operators/image.ts#L37)

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
