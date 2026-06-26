[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvalidColorError

# Class: InvalidColorError

Defined in: [src/errors.ts:254](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L254)

Thrown when an invalid color value is provided (e.g. component values
outside the `[0, 1]` range, unknown color type).

## Example

```ts
throw new InvalidColorError('RGB component out of range: r=1.5');
```

## Extends

- `Error`

## Constructors

### Constructor

> **new InvalidColorError**(`message`, `options?`): `InvalidColorError`

Defined in: [src/errors.ts:256](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L256)

#### Parameters

##### message

`string`

##### options?

`ErrorOptions`

#### Returns

`InvalidColorError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause?**: `unknown`

Defined in: tools/docs/node\_modules/typescript/lib/lib.es2022.error.d.ts:24

#### Inherited from

`Error.cause`

***

### message

> **message**: `string`

Defined in: tools/docs/node\_modules/typescript/lib/lib.es5.d.ts:1075

#### Inherited from

`Error.message`

***

### name

> `readonly` **name**: `"InvalidColorError"` = `'InvalidColorError'`

Defined in: [src/errors.ts:255](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L255)

#### Overrides

`Error.name`

***

### stack?

> `optional` **stack?**: `string`

Defined in: tools/docs/node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.stack`

## Methods

### isError()

> `static` **isError**(`error`): `error is Error`

Defined in: tools/docs/node\_modules/typescript/lib/lib.esnext.error.d.ts:21

Indicates whether the argument provided is a built-in Error instance or not.

#### Parameters

##### error

`unknown`

#### Returns

`error is Error`

#### Inherited from

`Error.isError`
