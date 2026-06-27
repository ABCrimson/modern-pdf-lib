[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / UnexpectedFieldTypeError

# Class: UnexpectedFieldTypeError

Defined in: [src/errors.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L102)

Thrown when a form field is accessed via the wrong typed getter
(e.g. calling `getTextField()` on a checkbox field).

## Extends

- `Error`

## Constructors

### Constructor

```ts
new UnexpectedFieldTypeError(
   fieldName, 
   expected, 
   actual, 
   options?): UnexpectedFieldTypeError;
```

Defined in: [src/errors.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L104)

#### Parameters

##### fieldName

`string`

##### expected

`string`

##### actual

`string`

##### options?

`ErrorOptions`

#### Returns

`UnexpectedFieldTypeError`

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
readonly name: "UnexpectedFieldTypeError" = 'UnexpectedFieldTypeError';
```

Defined in: [src/errors.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L103)

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
