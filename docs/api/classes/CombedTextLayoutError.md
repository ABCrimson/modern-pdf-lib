[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CombedTextLayoutError

# Class: CombedTextLayoutError

Defined in: [src/errors.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L191)

Thrown when a combed text field receives more characters than its
maximum length allows.

## Extends

- `Error`

## Constructors

### Constructor

```ts
new CombedTextLayoutError(
   textLength, 
   maxLength, 
   options?): CombedTextLayoutError;
```

Defined in: [src/errors.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L193)

#### Parameters

##### textLength

`number`

##### maxLength

`number`

##### options?

`ErrorOptions`

#### Returns

`CombedTextLayoutError`

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
readonly name: "CombedTextLayoutError" = 'CombedTextLayoutError';
```

Defined in: [src/errors.ts:192](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L192)

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
