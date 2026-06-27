[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / GradientFill

# Interface: GradientFill

Defined in: [src/core/patterns.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L134)

Descriptor for a gradient fill (linear or radial).
This is a lightweight value object — actual PDF objects are created
when [buildGradientObjects](../functions/buildGradientObjects.md) is called.

## Properties

### coords

```ts
readonly coords: readonly number[];
```

Defined in: [src/core/patterns.ts:137](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L137)

***

### extend

```ts
readonly extend: boolean;
```

Defined in: [src/core/patterns.ts:139](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L139)

***

### kind

```ts
readonly kind: "gradient";
```

Defined in: [src/core/patterns.ts:135](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L135)

***

### normalizedStops

```ts
readonly normalizedStops: readonly NormalizedStop[];
```

Defined in: [src/core/patterns.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L138)

***

### shadingType

```ts
readonly shadingType: 2 | 3;
```

Defined in: [src/core/patterns.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L136)
