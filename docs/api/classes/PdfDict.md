[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfDict

# Class: PdfDict

Defined in: [src/core/pdfObjects.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L275)

A PDF dictionary `<< … >>`.

## Constructors

### Constructor

```ts
new PdfDict(entries?): PdfDict;
```

Defined in: [src/core/pdfObjects.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L281)

#### Parameters

##### entries?

`Iterable`\&lt;readonly \[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\], `any`, `any`\&gt;

#### Returns

`PdfDict`

## Accessors

### size

#### Get Signature

```ts
get size(): number;
```

Defined in: [src/core/pdfObjects.ts:318](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L318)

Number of entries.

##### Returns

`number`

## Methods

### \[iterator\]()

```ts
iterator: IterableIterator<[string, PdfObject]>;
```

Defined in: [src/core/pdfObjects.ts:323](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L323)

Iterate over entries as `[key, value]` pairs.

#### Returns

`IterableIterator`\&lt;\[`string`, [`PdfObject`](../type-aliases/PdfObject.md)\]\&gt;

***

### delete()

```ts
delete(key): boolean;
```

Defined in: [src/core/pdfObjects.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L312)

Delete a key.

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### get()

```ts
get(key): PdfObject | undefined;
```

Defined in: [src/core/pdfObjects.ts:300](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L300)

Get a value by key.

#### Parameters

##### key

`string`

#### Returns

[`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

***

### has()

```ts
has(key): boolean;
```

Defined in: [src/core/pdfObjects.ts:306](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L306)

Check if a key exists.

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:327](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L327)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### set()

```ts
set(key, value): this;
```

Defined in: [src/core/pdfObjects.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L293)

Set a key-value pair.  Keys are always stored / looked up *with*
the leading `/`.

#### Parameters

##### key

`string`

##### value

[`PdfObject`](../type-aliases/PdfObject.md)

#### Returns

`this`
