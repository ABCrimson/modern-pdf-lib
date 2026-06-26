[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AccessibilityPluginOptions

# Interface: AccessibilityPluginOptions

Defined in: [src/plugins/builtins/accessibilityPlugin.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/accessibilityPlugin.ts#L22)

Options for the accessibility plugin.

## Properties

### language?

> `optional` **language?**: `string`

Defined in: [src/plugins/builtins/accessibilityPlugin.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/accessibilityPlugin.ts#L27)

BCP 47 language tag for the document (e.g. `'en-US'`, `'de-DE'`).
Default: `'en'`.

***

### markAsTagged?

> `optional` **markAsTagged?**: `boolean`

Defined in: [src/plugins/builtins/accessibilityPlugin.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/plugins/builtins/accessibilityPlugin.ts#L34)

When `true`, add a `/MarkInfo` dictionary with `/Marked true`
to the catalog, signaling tagged PDF.
Default: `true`.
