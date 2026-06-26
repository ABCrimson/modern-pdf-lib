---
title: Text Layout
---

# Text Layout

modern-pdf-lib includes an advanced text layout engine with paragraph reflow, justified alignment, automatic hyphenation, multi-column layout, and cross-page text flow. The engine produces raw PDF content-stream operators that can be appended directly to a page.

---

## Quick Start

### Simple Paragraph

```ts
import { createPdf, PageSizes } from 'modern-pdf-lib';
import { layoutParagraph } from 'modern-pdf-lib/layout';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);

const result = layoutParagraph(
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  { x: 50, y: 750, width: 500, height: 600 },
  { alignment: 'justify', lineHeight: 1.4 },
);

page.pushOperators(result.operators);
console.log(`Rendered ${result.lineCount} lines, used ${result.usedHeight}pt`);

const bytes = await doc.save();
```

---

## Text Frames

All layout functions operate on a `TextFrame` -- a rectangular region defined in PDF user-space coordinates (origin at bottom-left, Y increases upward):

```ts
interface TextFrame {
  x: number;       // Left edge
  y: number;       // Top edge (text flows downward from here)
  width: number;   // Available width
  height: number;  // Maximum height
}
```

```ts
const frame = { x: 72, y: 720, width: 468, height: 648 };
```

::: tip Coordinate System
PDF coordinates place the origin at the bottom-left. The `y` value in a TextFrame is the **top** of the text area -- text flows downward from `y` toward `y - height`.
:::

---

## Paragraph Options

The `ParagraphOptions` interface controls all typographic behavior:

```ts
const result = layoutParagraph(text, frame, {
  alignment: 'justify',       // 'left' | 'right' | 'center' | 'justify'
  lineHeight: 1.4,            // Multiplier (1.4 = 140% of font size)
  paragraphSpacing: 12,       // Extra points between paragraphs
  firstLineIndent: 24,        // Indent the first line of each paragraph
  hangingIndent: 0,            // Indent continuation lines
  hyphenation: true,           // Enable automatic hyphenation
  hyphenChar: '-',             // Character used for hyphenation
  locale: 'en',               // Locale for hyphenation rules
  orphanLines: 2,             // Minimum lines at bottom of frame
  widowLines: 2,              // Minimum lines at top of next frame
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `alignment` | `TextAlignment` | `'left'` | Text alignment mode |
| `lineHeight` | `number` | `1.2` | Line height multiplier |
| `paragraphSpacing` | `number` | `0` | Points between paragraphs |
| `firstLineIndent` | `number` | `0` | First-line indent in points |
| `hangingIndent` | `number` | `0` | Continuation line indent |
| `hyphenation` | `boolean` | `false` | Enable hyphenation |
| `hyphenChar` | `string` | `'-'` | Hyphen character |
| `locale` | `string` | -- | Hyphenation locale |
| `orphanLines` | `number` | `2` | Orphan control threshold |
| `widowLines` | `number` | `2` | Widow control threshold |

---

## Alignment Modes

```ts
// Left-aligned (default) -- ragged right edge
layoutParagraph(text, frame, { alignment: 'left' });

// Right-aligned -- ragged left edge
layoutParagraph(text, frame, { alignment: 'right' });

// Centered
layoutParagraph(text, frame, { alignment: 'center' });

// Justified -- adjusts word spacing to fill each line
layoutParagraph(text, frame, { alignment: 'justify' });
```

The justified alignment uses a Knuth-Plass-inspired algorithm that adjusts inter-word spacing to fill each line. The last line of each paragraph is left-aligned (standard typographic practice). Word spacing is clamped between 50% and 250% of normal to prevent extreme stretching or compression.

---

## Rich Text Spans

For mixed styling within a paragraph, pass an array of `TextSpan` objects instead of a plain string:

```ts
import type { TextSpan } from 'modern-pdf-lib/layout';
import { rgb } from 'modern-pdf-lib';

const spans: TextSpan[] = [
  { text: 'Important: ', bold: true, color: rgb(0.8, 0, 0) },
  { text: 'This paragraph contains ' },
  { text: 'mixed styles', italic: true, underline: true },
  { text: ' including ' },
  { text: 'superscript', superscript: true, fontSize: 8 },
  { text: ' and ' },
  { text: 'strikethrough', strikethrough: true },
  { text: ' text.' },
];

const result = layoutParagraph(spans, frame, { alignment: 'left' });
page.pushOperators(result.operators);
```

### TextSpan Properties

| Property | Type | Description |
|---|---|---|
| `text` | `string` | The text content (required) |
| `font` | `FontRef \| string` | Font reference or name |
| `fontSize` | `number` | Font size in points |
| `color` | `Color` | Text fill color |
| `bold` | `boolean` | Bold styling |
| `italic` | `boolean` | Italic styling |
| `underline` | `boolean` | Underline decoration |
| `strikethrough` | `boolean` | Strikethrough decoration |
| `superscript` | `boolean` | Superscript positioning |
| `subscript` | `boolean` | Subscript positioning |

---

## Automatic Hyphenation

Enable hyphenation to break long words at appropriate points when they do not fit on a line:

```ts
const result = layoutParagraph(
  'The extraordinarily complicated internationalization framework...',
  frame,
  { hyphenation: true, locale: 'en' },
);
```

The hyphenation engine uses suffix and prefix pattern matching to find valid break points. It supports common English patterns (e.g., `-tion`, `-ment`, `-able`, `un-`, `re-`, `dis-`) and respects minimum prefix/suffix lengths of 2 characters.

You can query hyphenation points programmatically:

```ts
import { findHyphenationPoints } from 'modern-pdf-lib/layout';

const points = findHyphenationPoints('internationalization');
// => [5, 10, 15] — possible break positions
```

---

## Multi-Column Layout

Use `layoutColumns()` to flow text across multiple columns within a single frame:

```ts
import { layoutColumns } from 'modern-pdf-lib/layout';
import { rgb } from 'modern-pdf-lib';

const result = layoutColumns(
  longArticleText,
  { x: 50, y: 750, width: 500, height: 650 },
  {
    columns: 3,
    columnGap: 18,           // Points between columns (default: 18)
    balanceColumns: true,     // Equalize column heights (default: true)
    columnRule: {             // Optional vertical rule between columns
      width: 0.5,
      color: rgb(0.7, 0.7, 0.7),
      style: 'solid',        // 'solid' | 'dashed'
    },
  },
  { alignment: 'justify', lineHeight: 1.3 },
);

page.pushOperators(result.operators);
```

### Column Balancing

When `balanceColumns` is `true` (the default), the engine pre-calculates the total number of lines and distributes them evenly across columns. This produces visually balanced output where all columns are approximately the same height.

---

## Multi-Page Text Flow

Use `layoutTextFlow()` to flow text across multiple frames -- typically one frame per page:

```ts
import { createPdf, PageSizes } from 'modern-pdf-lib';
import { layoutTextFlow } from 'modern-pdf-lib/layout';

const doc = createPdf();
const frames = [];

// Create 5 pages with identical text frames
for (let i = 0; i < 5; i++) {
  doc.addPage(PageSizes.A4);
  frames.push({ x: 72, y: 770, width: 451, height: 700 });
}

const results = layoutTextFlow(
  veryLongText,
  frames,
  { alignment: 'justify', lineHeight: 1.4, hyphenation: true },
);

// Apply operators to each page
for (let i = 0; i < results.length; i++) {
  const page = doc.getPage(i);
  if (results[i].operators) {
    page.pushOperators(results[i].operators);
  }
}

// Check for overflow beyond the last frame
const lastResult = results.at(-1)!;
if (lastResult.overflow) {
  console.warn(`Text overflow: "${lastResult.overflow.slice(0, 50)}..."`);
}

const bytes = await doc.save();
```

---

## Layout Result

All layout functions return a `TextLayoutResult`:

```ts
interface TextLayoutResult {
  operators: string;    // PDF content-stream operators
  lineCount: number;    // Number of lines rendered
  overflow: string;     // Text that did not fit in the frame(s)
  lastY: number;        // Y position after the last line
  usedHeight: number;   // Actual height consumed
}
```

Use `overflow` to detect when text exceeds the available space, and `lastY` to position content below the laid-out text.

---

## Widow and Orphan Control

The layout engine prevents isolated lines at frame boundaries:

- **Orphans**: Fewer than `orphanLines` at the bottom of a frame causes the text to push forward to the next frame entirely.
- **Widows**: Fewer than `widowLines` at the top of the next frame causes lines to be pulled back from the current frame.

```ts
layoutParagraph(text, frame, {
  orphanLines: 3,  // At least 3 lines at the bottom of a frame
  widowLines: 3,   // At least 3 lines at the top of the next frame
});
```

---

## Custom Text Measurement

By default, the layout engine uses a character-count heuristic for text measurement (0.5 * fontSize per character). For accurate layout with embedded fonts, provide a custom measurement function:

```ts
const result = layoutParagraph(
  text,
  frame,
  { alignment: 'justify' },
  (text, fontName, fontSize) => {
    // Return the width in points for the given text string
    return myFont.measureText(text, fontSize);
  },
);
```

::: warning
Without a custom measurement function, line breaks may not be perfectly accurate for proportional fonts. The heuristic works well for initial layout and testing but should be replaced with actual font metrics for production output.
:::

---

## Best Practices

1. **Use justified alignment with hyphenation** for body text -- this produces the most polished typographic output.

2. **Set appropriate `lineHeight`** -- 1.2 to 1.5 is typical for body text. Tighter values work for headings, looser values for readability.

3. **Enable widow/orphan control** for multi-page documents to avoid single-line fragments at frame boundaries.

4. **Use `layoutTextFlow` for long documents** -- it handles frame-to-frame continuation automatically and reports overflow.

5. **Provide a custom measurement function** for production output -- the default heuristic is approximate and may produce suboptimal line breaks with proportional fonts.

6. **Use `balanceColumns: true`** for multi-column layout to ensure columns are visually even.

---

## API Reference

| Export | Description |
|---|---|
| `layoutParagraph(spans, frame, options?, measureFn?)` | Lay out a paragraph in a single frame |
| `layoutColumns(spans, frame, columnOpts, paraOpts?, measureFn?)` | Multi-column layout |
| `layoutTextFlow(spans, frames, options?, measureFn?)` | Multi-frame text flow |
| `findHyphenationPoints(word, locale?)` | Find valid hyphenation positions |
| `TextFrame` | Rectangular layout region |
| `TextAlignment` | `'left' \| 'right' \| 'center' \| 'justify'` |
| `TextSpan` | Styled text segment |
| `ParagraphOptions` | Paragraph layout configuration |
| `MultiColumnOptions` | Column layout configuration |
| `TextLayoutResult` | Layout operation result |
