[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfPlugin

# Interface: PdfPlugin

Defined in: [src/plugins/pluginSystem.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L59)

Plugin lifecycle hooks -- plugins can intercept and modify behavior
at various points in the PDF creation pipeline.

## Properties

### name

```ts
readonly name: string;
```

Defined in: [src/plugins/pluginSystem.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L61)

Unique plugin name.

***

### version?

```ts
readonly optional version?: string;
```

Defined in: [src/plugins/pluginSystem.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L64)

Plugin version string.

## Methods

### onAfterAddPage()?

```ts
optional onAfterAddPage(page, doc): void;
```

Defined in: [src/plugins/pluginSystem.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L75)

Called after a page is added. Can add content to the page.

#### Parameters

##### page

[`PluginPage`](PluginPage.md)

##### doc

[`PluginDocument`](PluginDocument.md)

#### Returns

`void`

***

### onAfterSave()?

```ts
optional onAfterSave(bytes): 
  | Uint8Array<ArrayBufferLike>
| Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/plugins/pluginSystem.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L99)

Called after serialization. Can post-process the final PDF bytes.
May be async.

#### Parameters

##### bytes

`Uint8Array`

#### Returns

  \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;
  \| `Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

***

### onBeforeAddPage()?

```ts
optional onBeforeAddPage(size): PageSize;
```

Defined in: [src/plugins/pluginSystem.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L72)

Called before a page is added. Can modify page options.

#### Parameters

##### size

[`PageSize`](../type-aliases/PageSize.md)

#### Returns

[`PageSize`](../type-aliases/PageSize.md)

***

### onBeforeEmbedFont()?

```ts
optional onBeforeEmbedFont(data, options): object;
```

Defined in: [src/plugins/pluginSystem.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L81)

Called before font embedding. Can transform font data and options.
Return the (possibly modified) data and options.

#### Parameters

##### data

`Uint8Array`

##### options

[`EmbedFontOptions`](EmbedFontOptions.md)

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

### onBeforeEmbedImage()?

```ts
optional onBeforeEmbedImage(data): Uint8Array;
```

Defined in: [src/plugins/pluginSystem.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L87)

Called before image embedding. Can transform image data.

#### Parameters

##### data

`Uint8Array`

#### Returns

`Uint8Array`

***

### onBeforeSave()?

```ts
optional onBeforeSave(doc): void | Promise<void>;
```

Defined in: [src/plugins/pluginSystem.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L93)

Called before serialization. Can modify document structure.
May be async (e.g. for network-dependent plugins).

#### Parameters

##### doc

[`PluginDocument`](PluginDocument.md)

#### Returns

`void` \| `Promise`\&lt;`void`\&gt;

***

### onBuildCatalog()?

```ts
optional onBuildCatalog(catalog): void;
```

Defined in: [src/plugins/pluginSystem.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L102)

Called to add custom entries to the document catalog dict.

#### Parameters

##### catalog

[`PdfDict`](../classes/PdfDict.md)

#### Returns

`void`

***

### onBuildPageDict()?

```ts
optional onBuildPageDict(pageDict, pageIndex): void;
```

Defined in: [src/plugins/pluginSystem.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L105)

Called to add custom entries to page dictionaries.

#### Parameters

##### pageDict

[`PdfDict`](../classes/PdfDict.md)

##### pageIndex

`number`

#### Returns

`void`

***

### onRegister()?

```ts
optional onRegister(doc): void;
```

Defined in: [src/plugins/pluginSystem.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/pluginSystem.ts#L69)

Called when the plugin is registered on a document.

#### Parameters

##### doc

[`PluginDocument`](PluginDocument.md)

#### Returns

`void`
