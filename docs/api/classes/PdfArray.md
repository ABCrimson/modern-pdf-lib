[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfArray

# Class: PdfArray

Defined in: [src/core/pdfObjects.ts:235](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L235)

A PDF array `[…]`.

## Constructors

### Constructor

```ts
new PdfArray(items?): PdfArray;
```

Defined in: [src/core/pdfObjects.ts:239](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L239)

#### Parameters

##### items?

[`PdfObject`](../type-aliases/PdfObject.md)[] = `[]`

#### Returns

`PdfArray`

## Properties

### items

```ts
readonly items: PdfObject[] = [];
```

Defined in: [src/core/pdfObjects.ts:239](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L239)

## Accessors

### length

#### Get Signature

```ts
get length(): number;
```

Defined in: [src/core/pdfObjects.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L256)

Number of items.

##### Returns

`number`

## Methods

### push()

```ts
push(item): void;
```

Defined in: [src/core/pdfObjects.ts:251](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L251)

Add an item.

#### Parameters

##### item

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`void`

***

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:260](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L260)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### fromNumbers()

```ts
static fromNumbers(values): PdfArray;
```

Defined in: [src/core/pdfObjects.ts:246](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L246)

Convenience: create an array of PdfNumbers.

#### Parameters

##### values

`number`[]

#### Returns

`PdfArray`

***

### of()

```ts
static of(items): PdfArray;
```

Defined in: [src/core/pdfObjects.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L241)

#### Parameters

##### items

[`PdfObject`](../type-aliases/PdfObject.md)[]

#### Returns

`PdfArray`
