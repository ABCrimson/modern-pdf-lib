[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractMetrics

# Function: extractMetrics()

```ts
function extractMetrics(fontData): FontMetrics;
```

Defined in: [src/assets/font/fontMetrics.ts:629](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/fontMetrics.ts#L629)

Extract font metrics from raw TrueType / OpenType font bytes.

Parses the `head`, `hhea`, `hmtx`, `cmap`, `maxp`, `OS/2`, `name`,
and `post` tables to produce a complete [FontMetrics](../interfaces/FontMetrics.md) object.

## Parameters

### fontData

`Uint8Array`

The raw TTF or OTF file as a Uint8Array.

## Returns

[`FontMetrics`](../interfaces/FontMetrics.md)

Parsed font metrics.

## Throws

If required tables are missing or the data is corrupt.
