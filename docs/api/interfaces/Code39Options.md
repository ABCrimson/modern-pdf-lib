[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Code39Options

# Interface: Code39Options

Defined in: [src/barcode/code39.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L107)

Options for rendering a Code 39 barcode as PDF operators.

## Properties

### color?

```ts
readonly optional color?: Color;
```

Defined in: [src/barcode/code39.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L117)

Bar colour. Default: grayscale black.

***

### height?

```ts
readonly optional height?: number;
```

Defined in: [src/barcode/code39.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L109)

Height of the bars in user-space units. Default: `50`.

***

### includeCheckDigit?

```ts
readonly optional includeCheckDigit?: boolean;
```

Defined in: [src/barcode/code39.ts:121](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L121)

Include a modulo-43 check digit. Default: `false`.

***

### moduleWidth?

```ts
readonly optional moduleWidth?: number;
```

Defined in: [src/barcode/code39.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L111)

Width of a narrow module in user-space units. Default: `1`.

***

### quietZone?

```ts
readonly optional quietZone?: number;
```

Defined in: [src/barcode/code39.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L115)

Quiet-zone width in narrow modules on each side. Default: `10`.

***

### showText?

```ts
readonly optional showText?: boolean;
```

Defined in: [src/barcode/code39.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L119)

Show human-readable text below the barcode. Default: `false`.

***

### wideToNarrowRatio?

```ts
readonly optional wideToNarrowRatio?: number;
```

Defined in: [src/barcode/code39.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code39.ts#L113)

Wide-to-narrow ratio. Default: `3`. Must be &gt;= 2.
