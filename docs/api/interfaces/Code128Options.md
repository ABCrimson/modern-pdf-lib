[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Code128Options

# Interface: Code128Options

Defined in: [src/barcode/code128.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L155)

Options for rendering a Code 128 barcode as PDF operators.

## Properties

### color?

```ts
readonly optional color?: Color;
```

Defined in: [src/barcode/code128.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L163)

Bar colour. Default: black (grayscale 0).

***

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/barcode/code128.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L167)

Font size for the human-readable text. Default: `10`.

***

### height?

```ts
readonly optional height?: number;
```

Defined in: [src/barcode/code128.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L157)

Bar height in points. Default: `50`.

***

### moduleWidth?

```ts
readonly optional moduleWidth?: number;
```

Defined in: [src/barcode/code128.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L159)

Narrow bar (module) width in points. Default: `1`.

***

### quietZone?

```ts
readonly optional quietZone?: number;
```

Defined in: [src/barcode/code128.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L161)

Quiet zone width in modules. Default: `10`.

***

### showText?

```ts
readonly optional showText?: boolean;
```

Defined in: [src/barcode/code128.ts:165](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/code128.ts#L165)

Show human-readable text below the barcode. Default: `false`.
