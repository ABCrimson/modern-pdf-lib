[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TimestampPluginOptions

# Interface: TimestampPluginOptions

Defined in: [src/plugins/builtins/timestampPlugin.ts:20](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/builtins/timestampPlugin.ts#L20)

Options for the timestamp plugin.

## Properties

### setCreationDate?

```ts
optional setCreationDate?: boolean;
```

Defined in: [src/plugins/builtins/timestampPlugin.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/builtins/timestampPlugin.ts#L25)

When `true`, set the creation date on register (if not already set).
Default: `true`.

***

### setModificationDate?

```ts
optional setModificationDate?: boolean;
```

Defined in: [src/plugins/builtins/timestampPlugin.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/plugins/builtins/timestampPlugin.ts#L31)

When `true`, update the modification date before each save.
Default: `true`.
