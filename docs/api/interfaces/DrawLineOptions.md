[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DrawLineOptions

# Interface: DrawLineOptions

Defined in: [src/core/pdfPage.ts:285](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L285)

Options for [PdfPage.drawLine](../classes/PdfPage.md#drawline).

## Properties

### blendMode?

```ts
optional blendMode?: BlendMode;
```

Defined in: [src/core/pdfPage.ts:301](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L301)

Blend mode for compositing.

***

### color?

```ts
optional color?: Color;
```

Defined in: [src/core/pdfPage.ts:291](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L291)

Line colour.

***

### dashArray?

```ts
optional dashArray?: number[];
```

Defined in: [src/core/pdfPage.ts:295](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L295)

Dash pattern `[dashLength, gapLength]`.

***

### dashPhase?

```ts
optional dashPhase?: number;
```

Defined in: [src/core/pdfPage.ts:297](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L297)

Dash phase.

***

### end

```ts
end: Point;
```

Defined in: [src/core/pdfPage.ts:289](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L289)

End point.

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/core/pdfPage.ts:299](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L299)

Opacity `[0, 1]`.

***

### start

```ts
start: Point;
```

Defined in: [src/core/pdfPage.ts:287](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L287)

Start point.

***

### thickness?

```ts
optional thickness?: number;
```

Defined in: [src/core/pdfPage.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfPage.ts#L293)

Line width.
