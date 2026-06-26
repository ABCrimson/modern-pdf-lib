[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LayoutSinglelineOptions

# Interface: LayoutSinglelineOptions

Defined in: [src/core/layout.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L175)

Options for [layoutSinglelineText](../functions/layoutSinglelineText.md).

## Properties

### alignment?

```ts
optional alignment?: 0 | 1 | 2;
```

Defined in: [src/core/layout.ts:183](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L183)

Text alignment within bounds. Default: 'left'.

***

### bounds?

```ts
optional bounds?: object;
```

Defined in: [src/core/layout.ts:181](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L181)

Bounds width for alignment (optional).

#### height

```ts
height: number;
```

#### width

```ts
width: number;
```

***

### font

```ts
font: FontRef;
```

Defined in: [src/core/layout.ts:177](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L177)

The font to use for measurement.

***

### fontSize

```ts
fontSize: number;
```

Defined in: [src/core/layout.ts:179](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L179)

Font size in points.
