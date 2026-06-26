[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / QrCodeMatrix

# Interface: QrCodeMatrix

Defined in: [src/barcode/qr.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/qr.ts#L39)

The result of QR code encoding — a boolean matrix.

## Properties

### modules

```ts
readonly modules: readonly boolean[];
```

Defined in: [src/barcode/qr.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/qr.ts#L43)

Row-major boolean array. `true` = dark module.

***

### size

```ts
readonly size: number;
```

Defined in: [src/barcode/qr.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/qr.ts#L41)

Number of modules per side.

***

### version

```ts
readonly version: number;
```

Defined in: [src/barcode/qr.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/qr.ts#L45)

QR version (1-40).
