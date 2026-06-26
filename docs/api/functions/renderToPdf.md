[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / renderToPdf

# Function: renderToPdf()

> **renderToPdf**(`root`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: src/assets/vdom/reconciler.ts:131

Reconcile a [VNode](../type-aliases/VNode.md) tree into a saved PDF document.

The root is normalized to a list of pages: a `document` contributes its
`page` children directly, while any loose flow children (or a non-page
root) are auto-wrapped into a single page.  Within each page, children
flow downward from the top margin; `text` wraps at word boundaries to
the content width and `heading` text is rendered larger and bold.

## Parameters

### root

[`VNode`](../type-aliases/VNode.md)

The root node to render.

### options?

[`VdomRenderOptions`](../interfaces/VdomRenderOptions.md)

Optional layout overrides.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

A promise resolving to the saved PDF bytes (starting `%PDF-`).
