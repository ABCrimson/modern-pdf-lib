[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyGroupOptions

# Interface: TransparencyGroupOptions

Defined in: [src/core/pdfPage.ts:527](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfPage.ts#L527)

Options for transparency groups.

Transparency groups allow a set of drawing operations to be composited
as a single unit before being blended with the page content.

## Properties

### colorSpace?

> `optional` **colorSpace**: `"DeviceRGB"` \| `"DeviceCMYK"` \| `"DeviceGray"`

Defined in: [src/core/pdfPage.ts:541](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfPage.ts#L541)

Color space for the transparency group.  Default: `'DeviceRGB'`.

***

### isolated?

> `optional` **isolated**: `boolean`

Defined in: [src/core/pdfPage.ts:532](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfPage.ts#L532)

When `true`, the group is composited against a fully transparent
backdrop rather than the existing page content.  Default: `true`.

***

### knockout?

> `optional` **knockout**: `boolean`

Defined in: [src/core/pdfPage.ts:537](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfPage.ts#L537)

When `true`, earlier objects in the group are knocked out (replaced)
by later objects, rather than composited on top.  Default: `false`.
