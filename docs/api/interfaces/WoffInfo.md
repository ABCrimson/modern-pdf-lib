[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WoffInfo

# Interface: WoffInfo

Defined in: src/assets/font/woff.ts:58

Parsed summary of a WOFF / WOFF2 file header.

## Properties

### flavor

> `readonly` **flavor**: `number`

Defined in: src/assets/font/woff.ts:62

The wrapped sfnt flavor (e.g. `0x00010000` for TrueType, `OTTO`).

***

### numTables

> `readonly` **numTables**: `number`

Defined in: src/assets/font/woff.ts:64

Number of font tables contained in the file.

***

### signature

> `readonly` **signature**: `"wOFF"` \| `"wOF2"`

Defined in: src/assets/font/woff.ts:60

The container signature: `'wOFF'` (WOFF1) or `'wOF2'` (WOFF2).

***

### totalSfntSize

> `readonly` **totalSfntSize**: `number`

Defined in: src/assets/font/woff.ts:66

Size in bytes of the reconstructed (uncompressed) sfnt font.
