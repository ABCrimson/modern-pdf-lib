[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvalidFieldNamePartError

# Class: InvalidFieldNamePartError

Defined in: [src/errors.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L142)

Thrown when a field name part (between dots in a qualified name) is
empty or contains invalid characters.

## Extends

- `Error`

## Constructors

### Constructor

```ts
new InvalidFieldNamePartError(namePart, options?): InvalidFieldNamePartError;
```

Defined in: [src/errors.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L144)

#### Parameters

##### namePart

`string`

##### options?

`ErrorOptions`

#### Returns

`InvalidFieldNamePartError`

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
readonly name: "InvalidFieldNamePartError" = 'InvalidFieldNamePartError';
```

Defined in: [src/errors.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/errors.ts#L143)

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
