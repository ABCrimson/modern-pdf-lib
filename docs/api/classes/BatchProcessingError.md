[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchProcessingError

# Class: BatchProcessingError

Defined in: [src/errors.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L320)

Thrown when a batch processing operation fails.  Contains information
about which items succeeded and which failed.

## Example

```ts
throw new BatchProcessingError('2 of 5 documents failed', failures);
```

## Extends

- `Error`

## Constructors

### Constructor

> **new BatchProcessingError**(`message`, `failures`, `options?`): `BatchProcessingError`

Defined in: [src/errors.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L324)

#### Parameters

##### message

`string`

##### failures

readonly `object`[]

##### options?

`ErrorOptions`

#### Returns

`BatchProcessingError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause?**: `unknown`

Defined in: tools/docs/node\_modules/typescript/lib/lib.es2022.error.d.ts:24

#### Inherited from

`Error.cause`

***

### failures

> `readonly` **failures**: readonly `object`[]

Defined in: [src/errors.ts:323](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L323)

Details of individual item failures.

***

### message

> **message**: `string`

Defined in: tools/docs/node\_modules/typescript/lib/lib.es5.d.ts:1075

#### Inherited from

`Error.message`

***

### name

> `readonly` **name**: `"BatchProcessingError"` = `'BatchProcessingError'`

Defined in: [src/errors.ts:321](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L321)

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
