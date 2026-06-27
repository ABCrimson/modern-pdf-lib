[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExceededMaxLengthError

# Class: ExceededMaxLengthError

Defined in: [src/errors.ts:206](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L206)

Thrown when a text field value exceeds the field's declared
maximum length (/MaxLen).

## Extends

- `Error`

## Constructors

### Constructor

```ts
new ExceededMaxLengthError(
   textLength, 
   maxLength, 
   fieldName, 
   options?): ExceededMaxLengthError;
```

Defined in: [src/errors.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L208)

#### Parameters

##### textLength

`number`

##### maxLength

`number`

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`ExceededMaxLengthError`

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
readonly name: "ExceededMaxLengthError" = 'ExceededMaxLengthError';
```

Defined in: [src/errors.ts:207](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L207)

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
