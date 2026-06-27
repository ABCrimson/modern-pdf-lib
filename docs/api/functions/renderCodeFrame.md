[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / renderCodeFrame

# Function: renderCodeFrame()

```ts
function renderCodeFrame(
   source, 
   line, 
   column, 
   options?): string;
```

Defined in: [src/utils/codeframe.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/utils/codeframe.ts#L42)

Render a code frame: an excerpt of `source` centered on a 1-based
`line`/`column`, with a line-number gutter and a caret (`^`) underneath the
target column.

Lines outside the available source range are clamped. A non-positive
`contextLines` shows only the target line itself.

## Parameters

### source

`string`

The full source text.

### line

`number`

The 1-based line number to highlight.

### column

`number`

The 1-based column number to point the caret at.

### options?

[`CodeFrameOptions`](../interfaces/CodeFrameOptions.md)

Optional rendering options.

## Returns

`string`

A multi-line string ready to print in a diagnostic.
