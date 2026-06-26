[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createVNode

# Function: createVNode()

> **createVNode**(`type`, `props`, ...`children`): [`VNode`](../type-aliases/VNode.md)

Defined in: src/assets/vdom/reconciler.ts:77

Construct a well-formed [VNode](../type-aliases/VNode.md) from a type, a props bag, and
child nodes — a hyperscript-style helper.

`props` supplies the leaf attributes (`text`, `level`, `height`); the
variadic `children` become the node's children for container types.
Unknown or missing props fall back to sensible defaults.

## Parameters

### type

`"text"` \| `"document"` \| `"page"` \| `"heading"` \| `"spacer"`

The node type to create.

### props

`Record`\<`string`, `unknown`\>

Attribute bag (e.g. `{ text: 'hi', level: 2 }`).

### children

...[`VNode`](../type-aliases/VNode.md)[]

Child nodes for `document` / `page` containers.

## Returns

[`VNode`](../type-aliases/VNode.md)

A frozen-shaped [VNode](../type-aliases/VNode.md).
