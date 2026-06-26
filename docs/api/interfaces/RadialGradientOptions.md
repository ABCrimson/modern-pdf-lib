[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RadialGradientOptions

# Interface: RadialGradientOptions

Defined in: [src/core/patterns.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L75)

Options for creating a radial gradient (radial shading, ShadingType 3).

## Properties

### extend?

```ts
readonly optional extend?: boolean;
```

Defined in: [src/core/patterns.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L96)

Whether to extend the gradient beyond the start and end circles.
Default: `true`.

***

### r0

```ts
readonly r0: number;
```

Defined in: [src/core/patterns.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L81)

Radius of the start circle.

***

### r1

```ts
readonly r1: number;
```

Defined in: [src/core/patterns.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L87)

Radius of the end circle.

***

### stops

```ts
readonly stops: readonly (Color | ColorStop)[];
```

Defined in: [src/core/patterns.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L91)

Colour stops (same semantics as [LinearGradientOptions.stops](LinearGradientOptions.md#stops)).

***

### x0

```ts
readonly x0: number;
```

Defined in: [src/core/patterns.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L77)

Centre X of the start circle.

***

### x1

```ts
readonly x1: number;
```

Defined in: [src/core/patterns.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L83)

Centre X of the end circle.

***

### y0

```ts
readonly y0: number;
```

Defined in: [src/core/patterns.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L79)

Centre Y of the start circle.

***

### y1

```ts
readonly y1: number;
```

Defined in: [src/core/patterns.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L85)

Centre Y of the end circle.
