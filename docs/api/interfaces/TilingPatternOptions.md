[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TilingPatternOptions

# Interface: TilingPatternOptions

Defined in: [src/core/patterns.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L102)

Options for creating a tiling pattern (PatternType 1).

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/patterns.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L106)

Height of one tile in user-space units.

***

### ops

> `readonly` **ops**: `string`

Defined in: [src/core/patterns.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L122)

Raw PDF content-stream operators that paint one tile.

***

### paintType?

> `readonly` `optional` **paintType**: `1` \| `2`

Defined in: [src/core/patterns.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L113)

Paint type.
- `1` (default) — coloured: the pattern's content stream specifies
  its own colours.
- `2` — uncoloured: colours are supplied when the pattern is painted.

***

### tilingType?

> `readonly` `optional` **tilingType**: `1` \| `3` \| `2`

Defined in: [src/core/patterns.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L120)

Tiling type.
- `1` (default) — constant spacing.
- `2` — no distortion.
- `3` — constant spacing and faster tiling.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/patterns.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L104)

Width of one tile in user-space units.
