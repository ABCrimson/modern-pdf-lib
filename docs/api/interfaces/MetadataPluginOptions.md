[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MetadataPluginOptions

# Interface: MetadataPluginOptions

Defined in: [src/plugins/builtins/metadataPlugin.ts:20](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/metadataPlugin.ts#L20)

Options for the metadata plugin.

## Properties

### creator?

> `optional` **creator?**: `string`

Defined in: [src/plugins/builtins/metadataPlugin.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/metadataPlugin.ts#L28)

Optional creator string (e.g. application name).

***

### defaultAuthor?

> `optional` **defaultAuthor?**: `string`

Defined in: [src/plugins/builtins/metadataPlugin.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/metadataPlugin.ts#L34)

Optional default author. Only set if the document has no author.

***

### defaultTitle?

> `optional` **defaultTitle?**: `string`

Defined in: [src/plugins/builtins/metadataPlugin.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/metadataPlugin.ts#L31)

Optional default title. Only set if the document has no title.

***

### producer?

> `optional` **producer?**: `string`

Defined in: [src/plugins/builtins/metadataPlugin.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/metadataPlugin.ts#L25)

Producer string to set on the document.
Default: `'modern-pdf-lib'`.
