[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Pdf417Matrix

# Interface: Pdf417Matrix

Defined in: [src/barcode/pdf417.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/pdf417.ts#L47)

The result of PDF417 encoding — a 2D boolean matrix.

## Properties

### columns

```ts
readonly columns: number;
```

Defined in: [src/barcode/pdf417.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/pdf417.ts#L51)

Number of data columns.

***

### modules

```ts
readonly modules: readonly boolean[];
```

Defined in: [src/barcode/pdf417.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/pdf417.ts#L55)

Row-major boolean array. `true` = dark bar.

***

### moduleWidth

```ts
readonly moduleWidth: number;
```

Defined in: [src/barcode/pdf417.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/pdf417.ts#L53)

Total modules per row.

***

### rows

```ts
readonly rows: number;
```

Defined in: [src/barcode/pdf417.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/pdf417.ts#L49)

Number of rows.
