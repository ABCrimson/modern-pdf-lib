[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / VNode

# Type Alias: VNode

> **VNode** = \{ `children`: readonly `VNode`[]; `type`: `"document"`; \} \| \{ `children`: readonly `VNode`[]; `type`: `"page"`; \} \| \{ `level`: `number`; `text`: `string`; `type`: `"heading"`; \} \| \{ `text`: `string`; `type`: `"text"`; \} \| \{ `height`: `number`; `type`: `"spacer"`; \}

Defined in: src/assets/vdom/reconciler.ts:43

A node in the declarative document tree.

- `document` — the root; contains `page` children (or loose flow
  children that are auto-wrapped into a single page).
- `page` — a single physical page; contains flow children.
- `heading` — a bold, larger run of text sized by `level` (1 = largest).
- `text` — a paragraph of body text, wrapped to the content width.
- `spacer` — vertical whitespace of the given `height` in points.
