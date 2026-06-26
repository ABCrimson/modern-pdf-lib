[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EncryptedPdfError

# Class: EncryptedPdfError

Defined in: [src/errors.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L22)

Thrown when attempting to load or manipulate an encrypted PDF without
providing the correct password.

## Extends

- `Error`

## Constructors

### Constructor

```ts
new EncryptedPdfError(message?, options?): EncryptedPdfError;
```

Defined in: [src/errors.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L24)

#### Parameters

##### message?

`string` = `'The PDF is encrypted. Please provide a password.'`

##### options?

`ErrorOptions`

#### Returns

`EncryptedPdfError`

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
readonly name: "EncryptedPdfError" = 'EncryptedPdfError';
```

Defined in: [src/errors.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L23)

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
