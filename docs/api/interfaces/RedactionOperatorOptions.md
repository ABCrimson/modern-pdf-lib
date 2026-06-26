[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RedactionOperatorOptions

# Interface: RedactionOperatorOptions

Defined in: [src/annotation/applyRedactions.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L60)

Extended options for building redaction operators.

## Properties

### borderColor?

```ts
optional borderColor?: object;
```

Defined in: [src/annotation/applyRedactions.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L70)

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

Defined in: [src/annotation/applyRedactions.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L68)

Border width for the redaction rectangle outline (default: 0).

***

### opacity?

```ts
optional opacity?: number;
```

Defined in: [src/annotation/applyRedactions.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L72)

Opacity for the redaction overlay, 0–1 (default: 1).

***

### overlayAlignment?

```ts
optional overlayAlignment?: OverlayAlignment;
```

Defined in: [src/annotation/applyRedactions.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L66)

Horizontal alignment for overlay text (default: 'left').

***

### overlayFont?

```ts
optional overlayFont?: string;
```

Defined in: [src/annotation/applyRedactions.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L62)

Font name for overlay text (default: 'Helvetica').

***

### overlayFontSize?

```ts
optional overlayFontSize?: number;
```

Defined in: [src/annotation/applyRedactions.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/applyRedactions.ts#L64)

Font size for overlay text. When omitted, auto-calculated from rect height.
