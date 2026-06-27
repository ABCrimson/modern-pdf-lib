[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MetadataPluginOptions

# Interface: MetadataPluginOptions

Defined in: [src/plugins/builtins/metadataPlugin.ts:20](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/builtins/metadataPlugin.ts#L20)

Options for the metadata plugin.

## Properties

### creator?

```ts
optional creator?: string;
```

Defined in: [src/plugins/builtins/metadataPlugin.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/builtins/metadataPlugin.ts#L28)

Optional creator string (e.g. application name).

***

### defaultAuthor?

```ts
optional defaultAuthor?: string;
```

Defined in: [src/plugins/builtins/metadataPlugin.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/builtins/metadataPlugin.ts#L34)

Optional default author. Only set if the document has no author.

***

### defaultTitle?

```ts
optional defaultTitle?: string;
```

Defined in: [src/plugins/builtins/metadataPlugin.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/builtins/metadataPlugin.ts#L31)

Optional default title. Only set if the document has no title.

***

### producer?

```ts
optional producer?: string;
```

Defined in: [src/plugins/builtins/metadataPlugin.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/plugins/builtins/metadataPlugin.ts#L25)

Producer string to set on the document.
Default: `'modern-pdf-lib'`.
