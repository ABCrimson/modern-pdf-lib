[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawRectangleOptions

# Interface: DrawRectangleOptions

Defined in: [src/core/pdfPage.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L249)

Options for [PdfPage.drawRectangle](../classes/PdfPage.md#drawrectangle).

## Properties

### blendMode?

```ts
optional blendMode?: BlendMode;
```

Defined in: [src/core/pdfPage.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L269)

Blend mode for compositing.

***

### borderColor?

```ts
optional borderColor?: Color;
```

Defined in: [src/core/pdfPage.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L261)

Border (stroke) colour.  Set to `undefined` for no stroke.

***

### borderDashArray?

```ts
optional borderDashArray?: number[];
```

Defined in: [src/core/pdfPage.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L275)

Dash pattern for border `[dashLen, gapLen, ...]`.

***

### borderDashPhase?

```ts
optional borderDashPhase?: number;
```

Defined in: [src/core/pdfPage.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L277)

Dash phase offset for border.

***

### borderLineCap?

```ts
optional borderLineCap?: 0 | 1 | 2;
```

Defined in: [src/core/pdfPage.ts:279](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L279)

Line cap style for border (0 = butt, 1 = round, 2 = projecting square).

***

### borderOpacity?

```ts
optional borderOpacity?: number;
```

Defined in: [src/core/pdfPage.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L281)

Border stroke opacity `[0, 1]`, separate from fill opacity.

***

### borderWidth?

```ts
optional borderWidth?: number;
```

Defined in: [src/core/pdfPage.ts:263](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L263)

Border width in points.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:259](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L259)

Fill colour.  Set to `undefined` for no fill.

***

### height?

```ts
optional height?: number;
```

Defined in: [src/core/pdfPage.ts:257](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L257)

Rectangle height.

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/core/pdfPage.ts:267](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L267)

Opacity `[0, 1]`.

***

### rotate?

```ts
optional rotate?: Angle;
```

Defined in: [src/core/pdfPage.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L265)

Rotation angle.

***

### width?

```ts
optional width?: number;
```

Defined in: [src/core/pdfPage.ts:255](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L255)

Rectangle width.

***

### x?

```ts
optional x?: number;
```

Defined in: [src/core/pdfPage.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L251)

X coordinate.

***

### xSkew?

```ts
optional xSkew?: Angle;
```

Defined in: [src/core/pdfPage.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L271)

Horizontal skew angle.

***

### y?

```ts
optional y?: number;
```

Defined in: [src/core/pdfPage.ts:253](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L253)

Y coordinate.

***

### ySkew?

```ts
optional ySkew?: Angle;
```

Defined in: [src/core/pdfPage.ts:273](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L273)

Vertical skew angle.
