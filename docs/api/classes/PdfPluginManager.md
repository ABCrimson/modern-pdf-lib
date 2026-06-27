[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPluginManager

# Class: PdfPluginManager

Defined in: [src/plugins/pluginSystem.ts:117](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L117)

Manages plugin registration, ordering, and hook execution.

Plugins execute in registration order for every hook.

## Constructors

### Constructor

```ts
new PdfPluginManager(): PdfPluginManager;
```

#### Returns

`PdfPluginManager`

## Accessors

### hasPlugins

#### Get Signature

```ts
get hasPlugins(): boolean;
```

Defined in: [src/plugins/pluginSystem.ts:162](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L162)

Check whether any plugins are registered.

##### Returns

`boolean`

## Methods

### executeOnAfterAddPage()

```ts
executeOnAfterAddPage(page, doc): void;
```

Defined in: [src/plugins/pluginSystem.ts:197](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L197)

Execute `onAfterAddPage` across all plugins in order.

#### Parameters

##### page

[`PluginPage`](../interfaces/PluginPage.md)

##### doc

[`PluginDocument`](../interfaces/PluginDocument.md)

#### Returns

`void`

***

### executeOnAfterSave()

```ts
executeOnAfterSave(bytes): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/plugins/pluginSystem.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L252)

Execute `onAfterSave` across all plugins in order.
Each plugin may transform the output bytes; the final result is returned.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

***

### executeOnBeforeAddPage()

```ts
executeOnBeforeAddPage(size): PageSize;
```

Defined in: [src/plugins/pluginSystem.ts:184](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L184)

Execute `onBeforeAddPage` across all plugins in order.
Each plugin may modify the page size; the final result is returned.

#### Parameters

##### size

[`PageSize`](../type-aliases/PageSize.md)

#### Returns

[`PageSize`](../type-aliases/PageSize.md)

***

### executeOnBeforeEmbedFont()

```ts
executeOnBeforeEmbedFont(data, options): object;
```

Defined in: [src/plugins/pluginSystem.ts:209](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L209)

Execute `onBeforeEmbedFont` across all plugins in order.
Each plugin may modify the data/options; the final result is returned.

#### Parameters

##### data

`Uint8Array`

##### options

[`EmbedFontOptions`](../interfaces/EmbedFontOptions.md)

#### Returns

`object`

##### data

```ts
data: Uint8Array;
```

##### options

```ts
options: EmbedFontOptions;
```

***

### executeOnBeforeEmbedImage()

```ts
executeOnBeforeEmbedImage(data): Uint8Array;
```

Defined in: [src/plugins/pluginSystem.ts:226](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L226)

Execute `onBeforeEmbedImage` across all plugins in order.
Each plugin may transform the image data; the final result is returned.

#### Parameters

##### data

`Uint8Array`

#### Returns

`Uint8Array`

***

### executeOnBeforeSave()

```ts
executeOnBeforeSave(doc): Promise<void>;
```

Defined in: [src/plugins/pluginSystem.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L240)

Execute `onBeforeSave` across all plugins in order.
Awaits each plugin sequentially to maintain ordering guarantees.

#### Parameters

##### doc

[`PluginDocument`](../interfaces/PluginDocument.md)

#### Returns

`Promise`\&lt;`void`\&gt;

***

### executeOnBuildCatalog()

```ts
executeOnBuildCatalog(catalog): void;
```

Defined in: [src/plugins/pluginSystem.ts:265](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L265)

Execute `onBuildCatalog` across all plugins in order.

#### Parameters

##### catalog

[`PdfDict`](PdfDict.md)

#### Returns

`void`

***

### executeOnBuildPageDict()

```ts
executeOnBuildPageDict(pageDict, pageIndex): void;
```

Defined in: [src/plugins/pluginSystem.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L276)

Execute `onBuildPageDict` across all plugins in order.

#### Parameters

##### pageDict

[`PdfDict`](PdfDict.md)

##### pageIndex

`number`

#### Returns

`void`

***

### executeOnRegister()

```ts
executeOnRegister(plugin, doc): void;
```

Defined in: [src/plugins/pluginSystem.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L174)

Execute the `onRegister` hook on a single plugin.
Called internally when `.use()` is called on a document.

#### Parameters

##### plugin

[`PdfPlugin`](../interfaces/PdfPlugin.md)

##### doc

[`PluginDocument`](../interfaces/PluginDocument.md)

#### Returns

`void`

***

### get()

```ts
get(name): PdfPlugin | undefined;
```

Defined in: [src/plugins/pluginSystem.ts:152](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L152)

Get a registered plugin by name.

#### Parameters

##### name

`string`

#### Returns

[`PdfPlugin`](../interfaces/PdfPlugin.md) \| `undefined`

***

### list()

```ts
list(): readonly PdfPlugin[];
```

Defined in: [src/plugins/pluginSystem.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L157)

List all registered plugins in registration order.

#### Returns

readonly [`PdfPlugin`](../interfaces/PdfPlugin.md)[]

***

### register()

```ts
register(plugin): void;
```

Defined in: [src/plugins/pluginSystem.ts:129](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L129)

Register a plugin. Plugins execute in registration order.

#### Parameters

##### plugin

[`PdfPlugin`](../interfaces/PdfPlugin.md)

#### Returns

`void`

#### Throws

If a plugin with the same name is already registered.

***

### unregister()

```ts
unregister(name): boolean;
```

Defined in: [src/plugins/pluginSystem.ts:144](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/pluginSystem.ts#L144)

Unregister a plugin by name.

#### Parameters

##### name

`string`

#### Returns

`boolean`

`true` if the plugin was found and removed, `false` otherwise.
