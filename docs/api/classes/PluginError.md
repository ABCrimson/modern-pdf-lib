[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PluginError

# Class: PluginError

Defined in: [src/errors.ts:274](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L274)

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

```ts
new PluginError(
   pluginName, 
   message, 
   options?): PluginError;
```

Defined in: [src/errors.ts:278](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L278)

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
readonly name: "PluginError" = 'PluginError';
```

Defined in: [src/errors.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L275)

#### Overrides

```ts
Error.name
```

***

### pluginName

```ts
readonly pluginName: string;
```

Defined in: [src/errors.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/errors.ts#L277)

Name of the plugin that caused the error.

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
