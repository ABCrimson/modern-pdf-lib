---
title: Text Layout
---

# Text Layout

modern-pdf-lib includes an advanced text layout engine with paragraph reflow, justified alignment, automatic hyphenation, multi-column layout, and cross-page text flow. The engine produces raw PDF content-stream operators that can be appended directly to a page.

---

## Quick Start

### Simple Paragraph

```ts
import { createPdf, PageSizes, StandardFonts, layoutParagraph } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage(PageSizes.A4);
const helvetica = await doc.embedFont(StandardFonts.Helvetica);

const result = layoutParagraph(
  [{
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    font: helvetica,
  }],
  { x: 50, y: 750, width: 500, height: 600 },
  { alignment: 'justify', lineHeight: 1.4 },
);

page.pushOperators(result.operators);
console.log(`Rendered ${result.lineCount} lines, used ${result.usedHeight}pt`);

const bytes = await doc.save();
```

::: warning Fonts
Give every span a `font` from `embedFont()`. A span without one is drawn with the resource name `Helvetica`, which `embedFont()` never registers (fonts are registered as F1, F2, ...), so the text does not show. Text that overflows into the next column (`layoutColumns`) or frame (`layoutTextFlow`) is carried on as a plain string without its span's font, so only the first column or frame shows text. To flow text across frames, call `layoutParagraph` once per frame and wrap the previous result's overflow in a span: `layoutParagraph([{ text: prev.overflow, font: helvetica }], frame, options)`. The examples below assume `helvetica` is in scope.

The words of a paragraph are written in the encoding of the font they name (WinAnsiEncoding for the Latin standard fonts and for any name that is no standard font). A word with a character outside it, such as CJK text, or with a tab or another C0 control character throws `UnencodableTextError`; `layoutParagraph` breaks paragraphs on CRLF and CR as on LF.
:::

::: warning Word positions
Within a line, each word after the first is moved by one space width from the start of the previous word, not from its end (`Td` is relative to the line start), so words on the same line overlap.
:::

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
const result = layoutParagraph(spans, frame, {
  alignment: 'justify',       // 'left' | 'right' | 'center' | 'justify'
  lineHeight: 1.4,            // Multiplier (1.4 = 140% of font size)
  paragraphSpacing: 12,       // Extra points between paragraphs
  firstLineIndent: 24,        // Indent the first line of each paragraph
  hangingIndent: 0,            // Indent continuation lines
  hyphenation: true,           // Enable automatic hyphenation
  hyphenChar: '-',             // Character used for hyphenation
  locale: 'en',               // Accepted but currently ignored
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
| `locale` | `string` | -- | Accepted but currently ignored (English rules only) |
| `orphanLines` | `number` | `2` | Orphan control threshold |
| `widowLines` | `number` | `2` | Widow control threshold |

---

## Alignment Modes

```ts
// Left-aligned (default) -- ragged right edge
layoutParagraph(spans, frame, { alignment: 'left' });

// Right-aligned -- ragged left edge
layoutParagraph(spans, frame, { alignment: 'right' });

// Centered
layoutParagraph(spans, frame, { alignment: 'center' });

// Justified -- adjusts word spacing to fill each line
layoutParagraph(spans, frame, { alignment: 'justify' });
```

Justified text uses greedy line breaking and then widens inter-word spacing to fill each line. The last line of each paragraph is left-aligned (standard typographic practice). Word spacing is clamped between 50% and 250% of normal to prevent extreme stretching or compression.

---

## Rich Text Spans

For mixed styling within a paragraph, pass an array of `TextSpan` objects instead of a plain string:

```ts
import { StandardFonts, rgb, layoutParagraph } from 'modern-pdf-lib';

const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

const spans = [
  { text: 'Important: ', font: helveticaBold, color: rgb(0.8, 0, 0) },
  { text: 'This paragraph contains ', font: helvetica },
  { text: 'mixed styles', font: helvetica, underline: true },
  { text: ' including ', font: helvetica },
  { text: 'small text', font: helvetica, fontSize: 8 },
  { text: ' and ', font: helvetica },
  { text: 'strikethrough', font: helvetica, strikethrough: true },
  { text: ' text.', font: helvetica },
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
| `bold` | `boolean` | Reserved, currently no effect (set `font` to a bold `FontRef`) |
| `italic` | `boolean` | Reserved, currently no effect (set `font` to an italic `FontRef`) |
| `underline` | `boolean` | Underline decoration |
| `strikethrough` | `boolean` | Strikethrough decoration |
| `superscript` | `boolean` | Reserved, currently no effect |
| `subscript` | `boolean` | Reserved, currently no effect |

---

## Automatic Hyphenation

Enable hyphenation to break long words at appropriate points when they do not fit on a line:

```ts
const result = layoutParagraph(
  [{ text: 'The extraordinarily complicated internationalization framework...', font: helvetica }],
  frame,
  { hyphenation: true },
);
```

The hyphenation engine is a small English prefix/suffix heuristic, not dictionary or TeX-pattern hyphenation. It uses suffix and prefix pattern matching to find break points and supports common English patterns (e.g., `-tion`, `-ment`, `-able`, `un-`, `re-`, `dis-`) and respects minimum prefix/suffix lengths of 2 characters.

You can query hyphenation points programmatically:

```ts
import { findHyphenationPoints } from 'modern-pdf-lib';

const points = findHyphenationPoints('internationalization');
// => [2, 16]: after the prefix in- and before the suffix -tion
```

---

## Multi-Column Layout

Use `layoutColumns()` to split a frame into columns. Only the first column shows text, because the overflow passed to later columns loses the span font (see the Fonts warning above):

```ts
import { layoutColumns, rgb } from 'modern-pdf-lib';

const result = layoutColumns(
  [{ text: longArticleText, font: helvetica }],
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

When `balanceColumns` is `true` (the default), the engine counts the total lines first and gives every column frame the same height.

---

## Multi-Page Text Flow

Frames after the first lose the span font in `layoutTextFlow()` (see the Fonts warning above), so lay out one frame at a time with `layoutParagraph`:

```ts
import { createPdf, PageSizes, StandardFonts, layoutParagraph } from 'modern-pdf-lib';

const doc = createPdf();
const helvetica = await doc.embedFont(StandardFonts.Helvetica);
const frames = [];

// Create 5 pages with identical text frames
for (let i = 0; i < 5; i++) {
  doc.addPage(PageSizes.A4);
  frames.push({ x: 72, y: 770, width: 451, height: 700 });
}

const results = [];
let rest = veryLongText;
for (const frame of frames) {
  if (!rest) break;
  const r = layoutParagraph(
    [{ text: rest, font: helvetica }],
    frame,
    { alignment: 'justify', lineHeight: 1.4, hyphenation: true },
  );
  results.push(r);
  rest = r.overflow;
}

// Apply operators to each page
for (const [i, r] of results.entries()) {
  if (r.operators) {
    doc.getPage(i).pushOperators(r.operators);
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
layoutParagraph([{ text, font: helvetica }], frame, {
  orphanLines: 3,  // At least 3 lines at the bottom of a frame
  widowLines: 3,   // At least 3 lines at the top of the next frame
});
```

---

## Custom Text Measurement

By default, the layout engine uses a character-count heuristic for text measurement (0.5 * fontSize per character). For accurate layout with embedded fonts, provide a custom measurement function:

```ts
// The measurement function receives the font resource name, so map names back to FontRefs
const fonts = new Map([[helvetica.name, helvetica]]);

const result = layoutParagraph(
  [{ text, font: helvetica }],
  frame,
  { alignment: 'justify' },
  (t, fontName, fontSize) =>
    (fonts.get(fontName) ?? helvetica).widthOfTextAtSize(t, fontSize),
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

4. **Check `overflow`** for long documents -- `layoutTextFlow` reports text that did not fit, but frames after the first lose the span font (see the Fonts warning above).

5. **Provide a custom measurement function** for production output -- the default heuristic is approximate and may produce suboptimal line breaks with proportional fonts.

---

## API Reference

| Export | Description |
|---|---|
| `layoutParagraph(spans, frame, options?, measureFn?)` | Lay out a paragraph in a single frame |
| `layoutColumns(spans, frame, columnOpts, paraOpts?, measureFn?)` | Multi-column layout |
| `layoutTextFlow(spans, frames, options?, measureFn?)` | Multi-frame text flow |
| `findHyphenationPoints(word, locale?)` | Find hyphenation positions (`locale` is currently ignored) |
| `TextFrame` | Rectangular layout region |
| `TextAlignment` | `'left' \| 'right' \| 'center' \| 'justify'` |
| `TextSpan` | Styled text segment |
| `ParagraphOptions` | Paragraph layout configuration |
| `MultiColumnOptions` | Column layout configuration |
| `TextLayoutResult` | Layout operation result |
