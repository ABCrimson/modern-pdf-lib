[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BarcodeOptions

# Interface: BarcodeOptions

Defined in: [src/barcode/types.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L25)

Common options for rendering a barcode into PDF content-stream operators.

## Properties

### color?

```ts
readonly optional color?: Color;
```

Defined in: [src/barcode/types.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L33)

Bar colour. Default: grayscale black.

***

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/barcode/types.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L41)

Font size for human-readable text. Default: `10`.

***

### height?

```ts
readonly optional height?: number;
```

Defined in: [src/barcode/types.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L27)

Height of the bars in user-space units. Default: `50`.

***

### moduleWidth?

```ts
readonly optional moduleWidth?: number;
```

Defined in: [src/barcode/types.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L29)

Width of a single module in user-space units. Default: `1`.

***

### quietZone?

```ts
readonly optional quietZone?: number;
```

Defined in: [src/barcode/types.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L31)

Quiet-zone width in modules on each side. Default: `10`.

***

### showText?

```ts
readonly optional showText?: boolean;
```

Defined in: [src/barcode/types.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/types.ts#L39)

Whether to render human-readable text below the barcode.
Note: text rendering requires a font to be set in the content stream
beforehand.  Default: `false`.
