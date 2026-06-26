[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginMarkedContent

# Function: beginMarkedContent()

```ts
function beginMarkedContent(tag): string;
```

Defined in: [src/accessibility/markedContent.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/markedContent.ts#L62)

Generate a `BMC` (begin marked content) operator with just a tag.

This is the simplest form of marked content — no properties dict.
Produces: `/<tag> BMC\n`

## Parameters

### tag

`string`

The marked-content tag (e.g. `"Span"`, `"Artifact"`).

## Returns

`string`

The PDF operator string.
