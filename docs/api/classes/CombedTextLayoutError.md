[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CombedTextLayoutError

# Class: CombedTextLayoutError

Defined in: [src/errors.ts:191](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/errors.ts#L191)

Thrown when a combed text field receives more characters than its
maximum length allows.

## Extends

- `Error`

## Constructors

### Constructor

> **new CombedTextLayoutError**(`textLength`, `maxLength`, `options?`): `CombedTextLayoutError`

Defined in: [src/errors.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/errors.ts#L193)

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

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

Defined in: node\_modules/typescript/lib/lib.es2022.error.d.ts:24

#### Inherited from

`Error.cause`

***

### message

> **message**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1075

#### Inherited from

`Error.message`

***

### name

> `readonly` **name**: `"CombedTextLayoutError"` = `'CombedTextLayoutError'`

Defined in: [src/errors.ts:192](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/errors.ts#L192)

#### Overrides

`Error.name`

***

### stack?

> `optional` **stack**: `string`

Defined in: node\_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.stack`

## Methods

### isError()

> `static` **isError**(`error`): `error is Error`

Defined in: node\_modules/typescript/lib/lib.esnext.error.d.ts:21

Indicates whether the argument provided is a built-in Error instance or not.

#### Parameters

##### error

`unknown`

#### Returns

`error is Error`

#### Inherited from

`Error.isError`
