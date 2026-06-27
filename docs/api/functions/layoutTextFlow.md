[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutTextFlow

# Function: layoutTextFlow()

```ts
function layoutTextFlow(
   spans, 
   frames, 
   options?, 
   measureFn?): TextLayoutResult[];
```

Defined in: [src/layout/textLayout.ts:1029](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/textLayout.ts#L1029)

Lay out text across multiple frames (for multi-page flow).

Text flows from one frame to the next, with each frame producing
its own TextLayoutResult. Useful for flowing a long body of
text across multiple pages.

## Parameters

### spans

`string` \| `TextSpan`[]

The text content.

### frames

`TextFrame`[]

Array of frames to fill in order.

### options?

`ParagraphOptions`

Paragraph-level options.

### measureFn?

(`text`, `font`, `size`) =&gt; `number`

Optional text measurement function.

## Returns

`TextLayoutResult`[]

An array of results, one per frame used.
