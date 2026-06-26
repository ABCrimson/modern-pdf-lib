[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfName

# Class: PdfName

Defined in: [src/core/pdfObjects.ts:190](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L190)

A PDF name object — e.g. `/Type`, `/Page`.

The leading `/` is stored and serialized.  Characters outside the
printable ASCII range (33–126) and `#` are encoded as `#XX`.

## Properties

### value

```ts
readonly value: string;
```

Defined in: [src/core/pdfObjects.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L199)

The name value *including* the leading `/`.

## Methods

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:214](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L214)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### of()

```ts
static of(name): PdfName;
```

Defined in: [src/core/pdfObjects.ts:203](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L203)

Create or retrieve a cached `PdfName`.

#### Parameters

##### name

`string`

#### Returns

`PdfName`
