[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StyledBarcodeOptions

# Interface: StyledBarcodeOptions

Defined in: [src/barcode/style.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L26)

Full styling options for rendering a barcode with background,
borders, colours, and human-readable text.

## Properties

### backgroundColor?

```ts
readonly optional backgroundColor?: Color;
```

Defined in: [src/barcode/style.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L36)

Background color. Default: white.

***

### border?

```ts
readonly optional border?: boolean;
```

Defined in: [src/barcode/style.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L46)

Add a border around the barcode. Default: false.

***

### borderColor?

```ts
readonly optional borderColor?: Color;
```

Defined in: [src/barcode/style.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L50)

Border color. Default: black.

***

### borderWidth?

```ts
readonly optional borderWidth?: number;
```

Defined in: [src/barcode/style.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L48)

Border width in points. Default: 0.5.

***

### color?

```ts
readonly optional color?: Color;
```

Defined in: [src/barcode/style.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L34)

Bar color. Default: black.

***

### fontName?

```ts
readonly optional fontName?: string;
```

Defined in: [src/barcode/style.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L40)

Font name for human-readable text. Default: 'Helvetica'.

***

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/barcode/style.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L42)

Font size for text. Default: 10.

***

### height?

```ts
readonly optional height?: number;
```

Defined in: [src/barcode/style.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L28)

Bar height in points. Default: 50.

***

### moduleWidth?

```ts
readonly optional moduleWidth?: number;
```

Defined in: [src/barcode/style.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L30)

Module width in points. Default: 1.

***

### padding?

```ts
readonly optional padding?: number;
```

Defined in: [src/barcode/style.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L52)

Padding inside border in points. Default: 4.

***

### quietZone?

```ts
readonly optional quietZone?: number;
```

Defined in: [src/barcode/style.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L32)

Quiet zone in modules. Default: 10.

***

### showText?

```ts
readonly optional showText?: boolean;
```

Defined in: [src/barcode/style.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L38)

Show human-readable text below the barcode. Default: false.

***

### textColor?

```ts
readonly optional textColor?: Color;
```

Defined in: [src/barcode/style.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/style.ts#L44)

Text color. Default: same as bar color.
