# Annotations

This guide covers creating, reading, and manipulating PDF annotations with `modern-pdf-lib`. Annotations are interactive or visual elements overlaid on a page — sticky notes, links, highlights, shapes, stamps, and more.

## Common Properties

All annotation types share a base API inherited from `PdfAnnotation`:

```ts
import { PdfTextAnnotation, AnnotationFlags, rgb } from 'modern-pdf-lib';

const annot = PdfTextAnnotation.create({
  rect: [100, 700, 120, 720],   // [x1, y1, x2, y2] in PDF points
  contents: 'Review this section',
  author: 'Jane Smith',
  color: { r: 1, g: 0.9, b: 0 },
  opacity: 0.8,
  flags: AnnotationFlags.Print,
  border: { width: 1, style: 'solid' },
});

// All annotations support these getters/setters:
annot.getRect();            // [100, 700, 120, 720]
annot.setRect([50, 600, 70, 620]);
annot.getContents();        // 'Review this section'
annot.setContents('Updated note');
annot.getAuthor();          // 'Jane Smith'
annot.getColor();           // { r: 1, g: 0.9, b: 0 }
annot.getOpacity();         // 0.8
annot.isHidden();           // false
annot.isPrintable();        // true
annot.isLocked();           // false
```

## Text Annotations (Sticky Notes)

A text annotation renders as an icon that opens a popup with the annotation text:

```ts
import { PdfTextAnnotation } from 'modern-pdf-lib';

const note = PdfTextAnnotation.create({
  rect: [50, 750, 70, 770],
  contents: 'Please verify these figures.',
  icon: 'Comment',    // 'Note' | 'Comment' | 'Key' | 'Help' | 'NewParagraph' | 'Paragraph' | 'Insert'
  open: true,         // popup is initially visible
});

note.getIcon();   // 'Comment'
note.isOpen();    // true
note.setIcon('Key');
```

## Link Annotations

Link annotations create clickable regions that navigate to URLs or pages:

```ts
import { PdfLinkAnnotation } from 'modern-pdf-lib';

// External URL
const webLink = PdfLinkAnnotation.create({
  rect: [50, 700, 200, 720],
  url: 'https://example.com',
  highlightMode: 'Invert',  // 'None' | 'Invert' | 'Outline' | 'Push'
});

// Internal page jump
const pageLink = PdfLinkAnnotation.create({
  rect: [50, 670, 200, 690],
  pageIndex: 4,     // go to page 5 (0-indexed)
  fit: 'FitH',
});

webLink.getUrl();                // 'https://example.com'
pageLink.getDestination();       // [4, 'FitH']
```

## FreeText Annotations

FreeText annotations display text directly on the page (no icon or popup):

```ts
import { PdfFreeTextAnnotation } from 'modern-pdf-lib';

const freeText = PdfFreeTextAnnotation.create({
  rect: [50, 600, 300, 640],
  text: 'This is a visible text note',
  fontSize: 14,
  alignment: 'center',  // 'left' | 'center' | 'right'
});

freeText.getText();       // 'This is a visible text note'
freeText.getFontSize();   // 14
freeText.getAlignment();  // 'center'
```

## Text Markup Annotations

Highlight, underline, squiggly, and strikeout annotations mark regions of text:

```ts
import {
  PdfHighlightAnnotation,
  PdfUnderlineAnnotation,
  PdfSquigglyAnnotation,
  PdfStrikeOutAnnotation,
} from 'modern-pdf-lib';

// Quick creation from a rect
const highlight = PdfHighlightAnnotation.createForRect(
  [50, 700, 400, 720],
  { r: 1, g: 1, b: 0 },   // yellow
);

// Full creation with explicit quad points
const underline = PdfUnderlineAnnotation.create({
  rect: [50, 670, 400, 690],
  quadPoints: [50, 690, 400, 690, 50, 670, 400, 670],
  color: { r: 0, g: 0.5, b: 1 },
});

const squiggly = PdfSquigglyAnnotation.create({
  rect: [50, 640, 400, 660],
  color: { r: 1, g: 0, b: 0 },
});

const strikeout = PdfStrikeOutAnnotation.create({
  rect: [50, 610, 400, 630],
  color: { r: 1, g: 0, b: 0 },
});

highlight.getQuadPoints();  // [50, 720, 400, 720, 50, 700, 400, 700]
```

Quad points define the four corners of each marked text region as a flat array: `[x1, y1, x2, y2, x3, y3, x4, y4]` (top-left, top-right, bottom-left, bottom-right).

## Shape Annotations

### Line

```ts
import { PdfLineAnnotation } from 'modern-pdf-lib';

const line = PdfLineAnnotation.create({
  rect: [50, 500, 400, 520],
  linePoints: [50, 510, 400, 510],   // [x1, y1, x2, y2]
  lineEndingStart: 'None',
  lineEndingEnd: 'ClosedArrow',
  color: { r: 0, g: 0, b: 0 },
});

line.getLinePoints();         // [50, 510, 400, 510]
line.getLineEndingStyles();   // ['None', 'ClosedArrow']
```

Line ending styles: `'None'`, `'Square'`, `'Circle'`, `'Diamond'`, `'OpenArrow'`, `'ClosedArrow'`, `'Butt'`, `'ROpenArrow'`, `'RClosedArrow'`, `'Slash'`

### Square and Circle

```ts
import { PdfSquareAnnotation, PdfCircleAnnotation } from 'modern-pdf-lib';

const square = PdfSquareAnnotation.create({
  rect: [50, 400, 150, 480],
  color: { r: 0, g: 0, b: 1 },           // blue border
  interiorColor: { r: 0.9, g: 0.9, b: 1 }, // light blue fill
});

const circle = PdfCircleAnnotation.create({
  rect: [200, 400, 300, 480],
  color: { r: 1, g: 0, b: 0 },
  interiorColor: { r: 1, g: 0.9, b: 0.9 },
});

square.getInteriorColor();  // { r: 0.9, g: 0.9, b: 1 }
```

### Polygon and PolyLine

```ts
import { PdfPolygonAnnotation, PdfPolyLineAnnotation } from 'modern-pdf-lib';

const polygon = PdfPolygonAnnotation.create({
  rect: [50, 300, 250, 400],
  vertices: [50, 300, 150, 400, 250, 300],  // triangle
  color: { r: 0, g: 0.5, b: 0 },
  interiorColor: { r: 0.8, g: 1, b: 0.8 },
});

const polyline = PdfPolyLineAnnotation.create({
  rect: [50, 200, 300, 280],
  vertices: [50, 200, 100, 280, 200, 220, 300, 260],
  color: { r: 0.5, g: 0, b: 0.5 },
});

polygon.getVertices();  // [50, 300, 150, 400, 250, 300]
```

## Stamp Annotations

Stamp annotations represent rubber stamps with standard names:

```ts
import { PdfStampAnnotation } from 'modern-pdf-lib';

const stamp = PdfStampAnnotation.create({
  rect: [300, 700, 500, 750],
  stampName: 'Approved',
});

stamp.getStampName();  // 'Approved'
stamp.setStampName('Confidential');
```

Standard stamp names: `'Approved'`, `'Experimental'`, `'NotApproved'`, `'AsIs'`, `'Expired'`, `'NotForPublicRelease'`, `'Confidential'`, `'Final'`, `'Sold'`, `'Departmental'`, `'ForComment'`, `'TopSecret'`, `'Draft'`, `'ForPublicRelease'`

## Ink Annotations (Freehand Drawing)

Ink annotations record freehand pen strokes:

```ts
import { PdfInkAnnotation } from 'modern-pdf-lib';

const ink = PdfInkAnnotation.create({
  rect: [50, 100, 300, 200],
  inkLists: [
    [50, 150, 100, 180, 150, 130, 200, 170],  // stroke 1
    [220, 140, 260, 190, 300, 150],             // stroke 2
  ],
  color: { r: 0, g: 0, b: 1 },
});

ink.getInkLists();   // [[50, 150, ...], [220, 140, ...]]
ink.addInkList([50, 120, 300, 120]);  // add another stroke
ink.clearInkLists();
```

## Redact Annotations

Redact annotations mark regions for redaction. The actual content removal happens when the redaction is applied by a viewer:

```ts
import { PdfRedactAnnotation } from 'modern-pdf-lib';

const redact = PdfRedactAnnotation.create({
  rect: [100, 500, 400, 520],
  overlayText: 'REDACTED',
  interiorColor: { r: 0, g: 0, b: 0 },   // black fill
  quadPoints: [100, 520, 400, 520, 100, 500, 400, 500],
});

redact.getOverlayText();   // 'REDACTED'
redact.getInteriorColor(); // { r: 0, g: 0, b: 0 }
```

## Popup Annotations

Popup annotations display a floating window for a parent annotation's text:

```ts
import { PdfPopupAnnotation, PdfRef } from 'modern-pdf-lib';

const popup = PdfPopupAnnotation.create({
  rect: [130, 700, 330, 800],
  open: true,
});

popup.isOpen();   // true
popup.setOpen(false);

// Link to a parent annotation after registration
popup.setParent(PdfRef.of(42, 0));
popup.getParent();  // PdfRef { objectNumber: 42, generationNumber: 0 }
```

## Caret Annotations

Caret annotations mark text insertion points in review workflows:

```ts
import { PdfCaretAnnotation } from 'modern-pdf-lib';

const caret = PdfCaretAnnotation.create({
  rect: [200, 600, 210, 615],
  symbol: 'P',               // 'None' | 'P' (paragraph)
  caretRect: [2, 2, 2, 2],   // insets [left, bottom, right, top]
  contents: 'Insert new paragraph here',
});

caret.getSymbol();     // 'P'
caret.getCaretRect();  // [2, 2, 2, 2]
```

## File Attachment Annotations

File attachment annotations embed a file as a clickable icon on the page:

```ts
import { PdfFileAttachmentAnnotation } from 'modern-pdf-lib';

const attachment = PdfFileAttachmentAnnotation.create({
  rect: [50, 50, 70, 70],
  file: new TextEncoder().encode('Invoice data here'),
  fileName: 'invoice.xml',
  mimeType: 'application/xml',
  description: 'Original invoice data',
  icon: 'Paperclip',  // 'GraphPushPin' | 'PaperclipTag' | 'Paperclip' | 'Tag'
});

attachment.getIcon();      // 'Paperclip'
attachment.getFileName();  // 'invoice.xml' (read from /FS dict after build)

// Before serialization, build the file specification:
// attachment.buildFileSpec(registry);
```

## Appearance Generation

Several annotation types automatically generate their visual appearance streams. You can also use the standalone generators:

```ts
import {
  generateSquareAppearance,
  generateCircleAppearance,
  generateLineAppearance,
  generateHighlightAppearance,
  generateUnderlineAppearance,
  generateSquigglyAppearance,
  generateStrikeOutAppearance,
  generateInkAppearance,
  generateFreeTextAppearance,
} from 'modern-pdf-lib';

// These accept an annotation instance and return a PdfStream
const stream = generateSquareAppearance(square);
```

Appearance streams are generated automatically during serialization via `toDict(registry)` for types that have an appearance generator.

## Annotation Flags

Control annotation behavior with flags:

```ts
import { AnnotationFlags } from 'modern-pdf-lib';

const annot = PdfTextAnnotation.create({
  rect: [50, 700, 70, 720],
  flags: AnnotationFlags.Print | AnnotationFlags.ReadOnly,
});

// Or use convenience methods:
annot.setPrintable(true);
annot.setHidden(false);
annot.setLocked(true);

console.log(annot.isPrintable());  // true
console.log(annot.isLocked());     // true
```

| Flag | Value | Description |
|---|---|---|
| `Invisible` | `1 << 0` | Do not display if no handler |
| `Hidden` | `1 << 1` | Do not display or print |
| `Print` | `1 << 2` | Print when the page is printed |
| `NoZoom` | `1 << 3` | Do not scale with page zoom |
| `NoRotate` | `1 << 4` | Do not rotate with page |
| `NoView` | `1 << 5` | Do not display on screen |
| `ReadOnly` | `1 << 6` | Do not allow interaction |
| `Locked` | `1 << 7` | Do not allow deletion or property changes |
| `ToggleNoView` | `1 << 8` | Invert NoView for export |
| `LockedContents` | `1 << 9` | Do not allow content changes |

## Parsing Annotations from Existing PDFs

Use `annotationFromDict()` to reconstruct typed annotations from parsed PDF dictionaries:

```ts
import { annotationFromDict } from 'modern-pdf-lib';

// When parsing a PDF, annotation dicts are automatically typed:
const annot = annotationFromDict(parsedDict, resolver);
console.log(annot.getType());  // e.g., 'Highlight', 'Text', 'Link'
```
