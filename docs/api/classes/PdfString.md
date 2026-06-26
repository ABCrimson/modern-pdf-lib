[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfString

# Class: PdfString

Defined in: [src/core/pdfObjects.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L138)

A PDF string — either literal `(…)` or hexadecimal `<…>`.

By default the constructor produces a literal string.  Use the static
helpers for explicit control.

## Properties

### hex

```ts
readonly hex: boolean;
```

Defined in: [src/core/pdfObjects.ts:146](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L146)

When `true` the string is serialized in hexadecimal form `<…>`.

***

### value

```ts
readonly value: string;
```

Defined in: [src/core/pdfObjects.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L144)

The raw string content (unescaped).

## Methods

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L164)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### hex()

```ts
static hex(value): PdfString;
```

Defined in: [src/core/pdfObjects.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L155)

Create a hexadecimal string `<…>` from a plain string.

#### Parameters

##### value

`string`

#### Returns

`PdfString`

***

### hexFromBytes()

```ts
static hexFromBytes(data): PdfString;
```

Defined in: [src/core/pdfObjects.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L160)

Create a hexadecimal string from raw bytes.

#### Parameters

##### data

`Uint8Array`

#### Returns

`PdfString`

***

### literal()

```ts
static literal(value): PdfString;
```

Defined in: [src/core/pdfObjects.ts:150](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L150)

Create a literal string `(…)`.

#### Parameters

##### value

`string`

#### Returns

`PdfString`
