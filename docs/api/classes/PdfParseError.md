[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfParseError

# Class: PdfParseError

Defined in: [src/parser/parseError.ts:7](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L7)

## Extends

- `Error`

## Constructors

### Constructor

```ts
new PdfParseError(options): PdfParseError;
```

Defined in: [src/parser/parseError.ts:14](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L14)

#### Parameters

##### options

###### actual?

`string`

###### cause?

`Error`

###### data?

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;

###### expected?

`string`

###### message

`string`

###### offset

`number`

#### Returns

`PdfParseError`

#### Overrides

```ts
Error.constructor
```

## Properties

### actual

```ts
readonly actual: string;
```

Defined in: [src/parser/parseError.ts:11](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L11)

***

### cause?

```ts
optional cause?: unknown;
```

Defined in: tools/docs/node\_modules/typescript/lib/lib.es2022.error.d.ts:24

#### Inherited from

```ts
Error.cause
```

***

### expected

```ts
readonly expected: string;
```

Defined in: [src/parser/parseError.ts:10](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L10)

***

### hexContext

```ts
readonly hexContext: string;
```

Defined in: [src/parser/parseError.ts:12](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L12)

***

### message

```ts
message: string;
```

Defined in: tools/docs/node\_modules/typescript/lib/lib.es5.d.ts:1075

#### Inherited from

```ts
Error.message
```

***

### name

```ts
readonly name: "PdfParseError" = 'PdfParseError';
```

Defined in: [src/parser/parseError.ts:8](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L8)

#### Overrides

```ts
Error.name
```

***

### offset

```ts
readonly offset: number;
```

Defined in: [src/parser/parseError.ts:9](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/parseError.ts#L9)

***

### stack?

```ts
optional stack?: string;
```

Defined in: tools/docs/node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

```ts
Error.stack
```

## Methods

### isError()

```ts
static isError(error): error is Error;
```

Defined in: tools/docs/node\_modules/typescript/lib/lib.esnext.error.d.ts:21

Indicates whether the argument provided is a built-in Error instance or not.

#### Parameters

##### error

`unknown`

#### Returns

`error is Error`

#### Inherited from

```ts
Error.isError
```
