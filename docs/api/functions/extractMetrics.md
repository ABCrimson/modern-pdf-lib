[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractMetrics

# Function: extractMetrics()

> **extractMetrics**(`fontData`): [`FontMetrics`](../interfaces/FontMetrics.md)

Defined in: [src/assets/font/fontMetrics.ts:629](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/font/fontMetrics.ts#L629)

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
