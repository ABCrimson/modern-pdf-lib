[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LinearGradientOptions

# Interface: LinearGradientOptions

Defined in: [src/core/patterns.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L51)

Options for creating a linear gradient (axial shading, ShadingType 2).

## Properties

### extend?

```ts
readonly optional extend?: boolean;
```

Defined in: [src/core/patterns.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L69)

Whether to extend the gradient beyond the start and end points.
Default: `true`.

***

### stops

```ts
readonly stops: readonly (Color | ColorStop)[];
```

Defined in: [src/core/patterns.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L64)

Colour stops. Each element is either a bare [Color](../type-aliases/Color.md) (positions
are distributed evenly) or a [ColorStop](ColorStop.md) with an explicit offset.

***

### x1

```ts
readonly x1: number;
```

Defined in: [src/core/patterns.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L53)

Start X coordinate.

***

### x2

```ts
readonly x2: number;
```

Defined in: [src/core/patterns.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L57)

End X coordinate.

***

### y1

```ts
readonly y1: number;
```

Defined in: [src/core/patterns.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L55)

Start Y coordinate.

***

### y2

```ts
readonly y2: number;
```

Defined in: [src/core/patterns.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L59)

End Y coordinate.
