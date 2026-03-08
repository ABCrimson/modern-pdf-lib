[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldExistsAsNonTerminalError

# Class: FieldExistsAsNonTerminalError

Defined in: [src/errors.ts:153](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/errors.ts#L153)

Thrown when attempting to create a terminal field but a non-terminal
node (a field with /Kids but no /FT) already uses the same name.

## Extends

- `Error`

## Constructors

### Constructor

> **new FieldExistsAsNonTerminalError**(`fieldName`, `options?`): `FieldExistsAsNonTerminalError`

Defined in: [src/errors.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/errors.ts#L155)

#### Parameters

##### fieldName

`string`

##### options?

`ErrorOptions`

#### Returns

`FieldExistsAsNonTerminalError`

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

> `readonly` **name**: `"FieldExistsAsNonTerminalError"` = `'FieldExistsAsNonTerminalError'`

Defined in: [src/errors.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/errors.ts#L154)

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
