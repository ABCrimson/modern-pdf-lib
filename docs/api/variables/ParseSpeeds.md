[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ParseSpeeds

# Variable: ParseSpeeds

```ts
const ParseSpeeds: object;
```

Defined in: [src/core/enums.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/enums.ts#L88)

Preset parsing speeds — maps to objectsPerTick values in LoadPdfOptions.

Lower values keep the main thread more responsive but parse more slowly.

## Type Declaration

### Fast

```ts
readonly Fast: 500 = 500;
```

### Fastest

```ts
readonly Fastest: number;
```

### Medium

```ts
readonly Medium: 100 = 100;
```

### Slow

```ts
readonly Slow: 10 = 10;
```
