[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RedactionOptions

# Interface: RedactionOptions

Defined in: [src/core/redaction.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L33)

Options for marking a region for redaction.

## Properties

### borderColor?

```ts
optional borderColor?: object;
```

Defined in: [src/core/redaction.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L49)

Border colour (default: same as fill colour).

#### b

```ts
b: number;
```

#### g

```ts
g: number;
```

#### r

```ts
r: number;
```

***

### borderWidth?

```ts
optional borderWidth?: number;
```

Defined in: [src/core/redaction.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L47)

Border width for the redaction rectangle outline (default: 0 — no border).

***

### color?

```ts
optional color?: object;
```

Defined in: [src/core/redaction.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L39)

Colour for the redaction rectangle (default: black).

#### b

```ts
b: number;
```

#### g

```ts
g: number;
```

#### r

```ts
r: number;
```

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/core/redaction.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L51)

Opacity for the redaction overlay, 0–1 (default: 1 — fully opaque). Useful for preview/draft mode.

***

### overlayAlignment?

```ts
optional overlayAlignment?: OverlayAlignment;
```

Defined in: [src/core/redaction.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L45)

Horizontal alignment for overlay text (default: 'left').

***

### overlayFont?

```ts
optional overlayFont?: string;
```

Defined in: [src/core/redaction.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L41)

Custom font name for overlay text (default: 'Helvetica').

***

### overlayFontSize?

```ts
optional overlayFontSize?: number;
```

Defined in: [src/core/redaction.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L43)

Custom font size for overlay text. When omitted, auto-calculated from rect height.

***

### overlayText?

```ts
optional overlayText?: string;
```

Defined in: [src/core/redaction.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L37)

Optional text to overlay on the redacted area.

***

### rect

```ts
rect: [number, number, number, number];
```

Defined in: [src/core/redaction.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/redaction.ts#L35)

The rectangle to redact: [x, y, width, height].
