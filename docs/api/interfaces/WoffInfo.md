[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WoffInfo

# Interface: WoffInfo

Defined in: [src/assets/font/woff.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/woff.ts#L58)

Parsed summary of a WOFF / WOFF2 file header.

## Properties

### flavor

```ts
readonly flavor: number;
```

Defined in: [src/assets/font/woff.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/woff.ts#L62)

The wrapped sfnt flavor (e.g. `0x00010000` for TrueType, `OTTO`).

***

### numTables

```ts
readonly numTables: number;
```

Defined in: [src/assets/font/woff.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/woff.ts#L64)

Number of font tables contained in the file.

***

### signature

```ts
readonly signature: "wOFF" | "wOF2";
```

Defined in: [src/assets/font/woff.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/woff.ts#L60)

The container signature: `'wOFF'` (WOFF1) or `'wOF2'` (WOFF2).

***

### totalSfntSize

```ts
readonly totalSfntSize: number;
```

Defined in: [src/assets/font/woff.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/font/woff.ts#L66)

Size in bytes of the reconstructed (uncompressed) sfnt font.
