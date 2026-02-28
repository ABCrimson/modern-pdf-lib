[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RemovePageFromEmptyDocumentError

# Class: RemovePageFromEmptyDocumentError

Defined in: [src/errors.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/errors.ts#L74)

Thrown when attempting to remove a page from a document that has no pages.

## Extends

- `Error`

## Constructors

### Constructor

> **new RemovePageFromEmptyDocumentError**(`options?`): `RemovePageFromEmptyDocumentError`

Defined in: [src/errors.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/errors.ts#L76)

#### Parameters

##### options?

`ErrorOptions`

#### Returns

`RemovePageFromEmptyDocumentError`

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

> `readonly` **name**: `"RemovePageFromEmptyDocumentError"` = `'RemovePageFromEmptyDocumentError'`

Defined in: [src/errors.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/errors.ts#L75)

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
