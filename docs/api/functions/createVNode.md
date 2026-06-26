[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createVNode

# Function: createVNode()

```ts
function createVNode(
   type, 
   props, ...
   children): VNode;
```

Defined in: [src/assets/vdom/reconciler.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/vdom/reconciler.ts#L77)

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

`Record`\&lt;`string`, `unknown`\&gt;

Attribute bag (e.g. `{ text: 'hi', level: 2 }`).

### children

...[`VNode`](../type-aliases/VNode.md)[]

Child nodes for `document` / `page` containers.

## Returns

[`VNode`](../type-aliases/VNode.md)

A frozen-shaped [VNode](../type-aliases/VNode.md).
