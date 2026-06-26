[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfBool

# Class: PdfBool

Defined in: [src/core/pdfObjects.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L90)

A PDF boolean — `true` or `false`.

## Properties

### value

```ts
readonly value: boolean;
```

Defined in: [src/core/pdfObjects.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L97)

***

### FALSE

```ts
readonly static FALSE: PdfBool;
```

Defined in: [src/core/pdfObjects.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L92)

***

### TRUE

```ts
readonly static TRUE: PdfBool;
```

Defined in: [src/core/pdfObjects.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L91)

## Methods

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L103)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

```ts
static of(value): PdfBool;
```

Defined in: [src/core/pdfObjects.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L99)

#### Parameters

##### value

`boolean`

#### Returns

`PdfBool`
