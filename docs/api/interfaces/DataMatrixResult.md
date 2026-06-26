[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DataMatrixResult

# Interface: DataMatrixResult

Defined in: [src/barcode/dataMatrix.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L45)

The result of Data Matrix encoding — a boolean matrix.

## Properties

### cols

```ts
readonly cols: number;
```

Defined in: [src/barcode/dataMatrix.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L49)

Number of columns in the symbol.

***

### modules

```ts
readonly modules: readonly boolean[];
```

Defined in: [src/barcode/dataMatrix.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L51)

Row-major boolean array. `true` = dark module.

***

### rows

```ts
readonly rows: number;
```

Defined in: [src/barcode/dataMatrix.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L47)

Number of rows in the symbol.
