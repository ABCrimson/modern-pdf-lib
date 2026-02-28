[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LinearGradientOptions

# Interface: LinearGradientOptions

Defined in: [src/core/patterns.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L51)

Options for creating a linear gradient (axial shading, ShadingType 2).

## Properties

### extend?

> `readonly` `optional` **extend**: `boolean`

Defined in: [src/core/patterns.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L69)

Whether to extend the gradient beyond the start and end points.
Default: `true`.

***

### stops

> `readonly` **stops**: readonly ([`Color`](../type-aliases/Color.md) \| [`ColorStop`](ColorStop.md))[]

Defined in: [src/core/patterns.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L64)

Colour stops. Each element is either a bare [Color](../type-aliases/Color.md) (positions
are distributed evenly) or a [ColorStop](ColorStop.md) with an explicit offset.

***

### x1

> `readonly` **x1**: `number`

Defined in: [src/core/patterns.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L53)

Start X coordinate.

***

### x2

> `readonly` **x2**: `number`

Defined in: [src/core/patterns.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L57)

End X coordinate.

***

### y1

> `readonly` **y1**: `number`

Defined in: [src/core/patterns.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L55)

Start Y coordinate.

***

### y2

> `readonly` **y2**: `number`

Defined in: [src/core/patterns.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/patterns.ts#L59)

End Y coordinate.
