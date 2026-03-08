[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyGroupOptions

# Interface: TransparencyGroupOptions

Defined in: [src/core/pdfPage.ts:549](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L549)

Options for transparency groups.

Transparency groups allow a set of drawing operations to be composited
as a single unit before being blended with the page content.

## Properties

### colorSpace?

> `optional` **colorSpace**: `"DeviceRGB"` \| `"DeviceCMYK"` \| `"DeviceGray"`

Defined in: [src/core/pdfPage.ts:563](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L563)

Color space for the transparency group.  Default: `'DeviceRGB'`.

***

### isolated?

> `optional` **isolated**: `boolean`

Defined in: [src/core/pdfPage.ts:554](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L554)

When `true`, the group is composited against a fully transparent
backdrop rather than the existing page content.  Default: `true`.

***

### knockout?

> `optional` **knockout**: `boolean`

Defined in: [src/core/pdfPage.ts:559](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfPage.ts#L559)

When `true`, earlier objects in the group are knocked out (replaced)
by later objects, rather than composited on top.  Default: `false`.
