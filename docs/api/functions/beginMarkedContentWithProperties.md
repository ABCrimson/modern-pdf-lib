[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / beginMarkedContentWithProperties

# Function: beginMarkedContentWithProperties()

```ts
function beginMarkedContentWithProperties(tag, properties): string;
```

Defined in: [src/accessibility/markedContent.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/markedContent.ts#L79)

Generate a `BDC` (begin marked-content with properties) operator.

The properties dictionary is serialized inline.  This is used when
you need to associate additional data (like MCID) with the marked
content.

Produces: `/<tag> <</MCID n /key1 value1 ...>> BDC\n`

## Parameters

### tag

`string`

The marked-content tag.

### properties

`Record`\&lt;`string`, `unknown`\&gt;

Key-value pairs for the properties dictionary.

## Returns

`string`

The PDF operator string.
