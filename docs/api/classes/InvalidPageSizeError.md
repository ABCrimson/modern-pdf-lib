[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvalidPageSizeError

# Class: InvalidPageSizeError

Defined in: [src/errors.ts:230](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L230)

Thrown when an invalid page size is provided (e.g. zero or negative
dimensions, non-finite values).

## Example

```ts
throw new InvalidPageSizeError(0, 842);
```

## Extends

- `Error`

## Constructors

### Constructor

```ts
new InvalidPageSizeError(
   width, 
   height, 
   options?): InvalidPageSizeError;
```

Defined in: [src/errors.ts:232](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L232)

#### Parameters

##### width

`number`

##### height

`number`

##### options?

`ErrorOptions`

#### Returns

`InvalidPageSizeError`

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
readonly name: "InvalidPageSizeError" = 'InvalidPageSizeError';
```

Defined in: [src/errors.ts:231](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L231)

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
