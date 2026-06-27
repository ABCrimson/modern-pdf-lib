[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TilingPatternOptions

# Interface: TilingPatternOptions

Defined in: [src/core/patterns.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L102)

Options for creating a tiling pattern (PatternType 1).

## Properties

### height

```ts
readonly height: number;
```

Defined in: [src/core/patterns.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L106)

Height of one tile in user-space units.

***

### ops

```ts
readonly ops: string;
```

Defined in: [src/core/patterns.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L122)

Raw PDF content-stream operators that paint one tile.

***

### paintType?

```ts
readonly optional paintType?: 1 | 2;
```

Defined in: [src/core/patterns.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L113)

Paint type.
- `1` (default) — coloured: the pattern's content stream specifies
  its own colours.
- `2` — uncoloured: colours are supplied when the pattern is painted.

***

### tilingType?

```ts
readonly optional tilingType?: 1 | 2 | 3;
```

Defined in: [src/core/patterns.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L120)

Tiling type.
- `1` (default) — constant spacing.
- `2` — no distortion.
- `3` — constant spacing and faster tiling.

***

### width

```ts
readonly width: number;
```

Defined in: [src/core/patterns.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L104)

Width of one tile in user-space units.
