[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvalidFieldNamePartError

# Class: InvalidFieldNamePartError

Defined in: [src/errors.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/errors.ts#L142)

Thrown when a field name part (between dots in a qualified name) is
empty or contains invalid characters.

## Extends

- `Error`

## Constructors

### Constructor

> **new InvalidFieldNamePartError**(`namePart`, `options?`): `InvalidFieldNamePartError`

Defined in: [src/errors.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/errors.ts#L144)

#### Parameters

##### namePart

`string`

##### options?

`ErrorOptions`

#### Returns

`InvalidFieldNamePartError`

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

> `readonly` **name**: `"InvalidFieldNamePartError"` = `'InvalidFieldNamePartError'`

Defined in: [src/errors.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/errors.ts#L143)

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
