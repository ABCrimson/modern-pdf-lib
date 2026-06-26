[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / VdomRenderOptions

# Interface: VdomRenderOptions

Defined in: [src/assets/vdom/reconciler.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/vdom/reconciler.ts#L53)

Options controlling how a [VNode](../type-aliases/VNode.md) tree is rendered to PDF.

## Properties

### fontSize?

```ts
readonly optional fontSize?: number;
```

Defined in: [src/assets/vdom/reconciler.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/vdom/reconciler.ts#L55)

Base body font size in points. Default: 12.

***

### margin?

```ts
readonly optional margin?: number;
```

Defined in: [src/assets/vdom/reconciler.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/vdom/reconciler.ts#L57)

Page margin in points applied on all four sides. Default: 50.
