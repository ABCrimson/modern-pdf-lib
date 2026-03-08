[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WatermarkOptions

# Interface: WatermarkOptions

Defined in: [src/core/watermark.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L26)

Options for watermark rendering.

## Properties

### color?

> `optional` **color**: `object`

Defined in: [src/core/watermark.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L32)

Text colour as RGB (0-1 range, default: light gray).

#### b

> **b**: `number`

#### g

> **g**: `number`

#### r

> **r**: `number`

***

### fontSize?

> `optional` **fontSize**: `number`

Defined in: [src/core/watermark.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L30)

Font size in points (default: 60).

***

### opacity?

> `optional` **opacity**: `number`

Defined in: [src/core/watermark.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L34)

Opacity from 0 (invisible) to 1 (opaque), default: 0.3.

***

### position?

> `optional` **position**: `"top"` \| `"center"` \| `"bottom"`

Defined in: [src/core/watermark.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L38)

Position: `'center'`, `'top'`, or `'bottom'` (default: `'center'`).

***

### rotation?

> `optional` **rotation**: `number`

Defined in: [src/core/watermark.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L36)

Rotation angle in degrees (default: 45).

***

### text

> **text**: `string`

Defined in: [src/core/watermark.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/watermark.ts#L28)

The watermark text.
