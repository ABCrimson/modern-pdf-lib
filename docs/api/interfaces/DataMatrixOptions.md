[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DataMatrixOptions

# Interface: DataMatrixOptions

Defined in: [src/barcode/dataMatrix.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L33)

Options for rendering a Data Matrix to PDF operators.

## Properties

### backgroundColor?

```ts
readonly optional backgroundColor?: Color;
```

Defined in: [src/barcode/dataMatrix.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L39)

Background colour. Default: white.

***

### color?

```ts
readonly optional color?: Color;
```

Defined in: [src/barcode/dataMatrix.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L37)

Foreground (dark module) colour. Default: black.

***

### moduleSize?

```ts
readonly optional moduleSize?: number;
```

Defined in: [src/barcode/dataMatrix.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L35)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

```ts
readonly optional quietZone?: number;
```

Defined in: [src/barcode/dataMatrix.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L41)

Number of quiet-zone modules around the code. Default: `1`.
