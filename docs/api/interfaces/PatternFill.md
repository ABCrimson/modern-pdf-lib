[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PatternFill

# Interface: PatternFill

Defined in: [src/core/patterns.ts:153](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L153)

Descriptor for a tiling pattern fill.
This is a lightweight value object — actual PDF objects are created
when [buildPatternObjects](../functions/buildPatternObjects.md) is called.

## Properties

### height

```ts
readonly height: number;
```

Defined in: [src/core/patterns.ts:156](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L156)

***

### kind

```ts
readonly kind: "pattern";
```

Defined in: [src/core/patterns.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L154)

***

### ops

```ts
readonly ops: string;
```

Defined in: [src/core/patterns.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L159)

***

### paintType

```ts
readonly paintType: 1 | 2;
```

Defined in: [src/core/patterns.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L157)

***

### tilingType

```ts
readonly tilingType: 1 | 2 | 3;
```

Defined in: [src/core/patterns.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L158)

***

### width

```ts
readonly width: number;
```

Defined in: [src/core/patterns.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L155)
