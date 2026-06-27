[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RichTextFieldReadError

# Class: RichTextFieldReadError

Defined in: [src/errors.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L172)

Thrown when attempting to read the rich text value (/RV) of a field
that does not support it or whose rich text is malformed.

## Extends

- `Error`

## Constructors

### Constructor

```ts
new RichTextFieldReadError(fieldName, options?): RichTextFieldReadError;
```

Defined in: [src/errors.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L174)

#### Parameters

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`RichTextFieldReadError`

#### Overrides

```ts
Error.constructor
```

## Properties

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
readonly name: "RichTextFieldReadError" = 'RichTextFieldReadError';
```

Defined in: [src/errors.ts:173](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L173)

#### Overrides

```ts
Error.name
```

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
