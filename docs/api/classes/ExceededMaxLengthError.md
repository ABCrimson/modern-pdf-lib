[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ExceededMaxLengthError

# Class: ExceededMaxLengthError

Defined in: [src/errors.ts:206](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/errors.ts#L206)

Thrown when a text field value exceeds the field's declared
maximum length (/MaxLen).

## Extends

- `Error`

## Constructors

### Constructor

> **new ExceededMaxLengthError**(`textLength`, `maxLength`, `fieldName`, `options?`): `ExceededMaxLengthError`

Defined in: [src/errors.ts:208](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/errors.ts#L208)

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

> `readonly` **name**: `"ExceededMaxLengthError"` = `'ExceededMaxLengthError'`

Defined in: [src/errors.ts:207](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/errors.ts#L207)

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
