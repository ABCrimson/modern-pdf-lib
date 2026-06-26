[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PluginError

# Class: PluginError

Defined in: [src/errors.ts:274](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L274)

Thrown when a plugin encounters an error during initialization or
execution.  Wraps the underlying cause for error-chain inspection.

## Example

```ts
throw new PluginError('myPlugin', 'Failed to initialize WASM module');
```

## Extends

- `Error`

## Constructors

### Constructor

> **new PluginError**(`pluginName`, `message`, `options?`): `PluginError`

Defined in: [src/errors.ts:278](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L278)

#### Parameters

##### pluginName

`string`

##### message

`string`

##### options?

`ErrorOptions`

#### Returns

`PluginError`

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

> `readonly` **name**: `"PluginError"` = `'PluginError'`

Defined in: [src/errors.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L275)

#### Overrides

`Error.name`

***

### pluginName

> `readonly` **pluginName**: `string`

Defined in: [src/errors.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/errors.ts#L277)

Name of the plugin that caused the error.

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
