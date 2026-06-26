[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParseError

# Class: StreamingParseError

Defined in: [src/errors.ts:297](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L297)

Thrown when a streaming (incremental) parse operation encounters
corrupt or incomplete data that prevents further processing.

## Example

```ts
throw new StreamingParseError('Unexpected EOF at byte offset 4096');
```

## Extends

- `Error`

## Constructors

### Constructor

> **new StreamingParseError**(`message`, `offset?`, `options?`): `StreamingParseError`

Defined in: [src/errors.ts:301](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L301)

#### Parameters

##### message

`string`

##### offset?

`number`

##### options?

`ErrorOptions`

#### Returns

`StreamingParseError`

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

> `readonly` **name**: `"StreamingParseError"` = `'StreamingParseError'`

Defined in: [src/errors.ts:298](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L298)

#### Overrides

`Error.name`

***

### offset?

> `readonly` `optional` **offset?**: `number`

Defined in: [src/errors.ts:300](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L300)

Byte offset where the error occurred, if known.

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
