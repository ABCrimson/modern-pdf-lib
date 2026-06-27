[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutParagraph

# Function: layoutParagraph()

```ts
function layoutParagraph(
   spans, 
   frame, 
   options?, 
   measureFn?): TextLayoutResult;
```

Defined in: [src/layout/textLayout.ts:749](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/textLayout.ts#L749)

Lay out a paragraph of text in a frame with full typographic control.

Accepts plain text or an array of styled TextSpan objects.
Performs word wrapping, alignment, optional hyphenation, and
widow/orphan control.

## Parameters

### spans

`string` \| `TextSpan`[]

The text content, as a plain string or styled spans.

### frame

`TextFrame`

The rectangular frame to lay text into.

### options?

`ParagraphOptions`

Paragraph layout options (alignment, hyphenation, etc.).

### measureFn?

(`text`, `font`, `size`) =&gt; `number`

Optional text measurement function. If omitted, a
                  character-count heuristic is used.

## Returns

`TextLayoutResult`

A TextLayoutResult with operators and overflow.
