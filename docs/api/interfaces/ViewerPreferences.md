[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ViewerPreferences

# Interface: ViewerPreferences

Defined in: [src/metadata/viewerPreferences.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L45)

Viewer preference settings for a PDF document.

All properties are optional.  Omitted properties use the viewer's
default behaviour.

## Properties

### centerWindow?

> `optional` **centerWindow**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L55)

Center the document's window on the screen.

***

### direction?

> `optional` **direction**: `"L2R"` \| `"R2L"`

Defined in: [src/metadata/viewerPreferences.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L61)

Predominant reading order for text.

***

### displayDocTitle?

> `optional` **displayDocTitle**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L57)

Display the document title (from /Info /Title) in the title bar.

***

### duplex?

> `optional` **duplex**: `"Simplex"` \| `"DuplexFlipShortEdge"` \| `"DuplexFlipLongEdge"`

Defined in: [src/metadata/viewerPreferences.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L65)

Paper handling option for duplex printing.

***

### fitWindow?

> `optional` **fitWindow**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L53)

Resize the document's window to fit the first page.

***

### hideMenubar?

> `optional` **hideMenubar**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L49)

Hide the viewer's menu bar when the document is active.

***

### hideToolbar?

> `optional` **hideToolbar**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L47)

Hide the viewer's toolbar when the document is active.

***

### hideWindowUI?

> `optional` **hideWindowUI**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L51)

Hide the viewer's window UI elements (scrollbars, etc.).

***

### nonFullScreenPageMode?

> `optional` **nonFullScreenPageMode**: `"UseNone"` \| `"UseOutlines"` \| `"UseThumbs"` \| `"UseOC"`

Defined in: [src/metadata/viewerPreferences.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L59)

Page mode to use when exiting full-screen mode.

***

### numCopies?

> `optional` **numCopies**: `number`

Defined in: [src/metadata/viewerPreferences.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L69)

Default number of copies to print.

***

### pickTrayByPDFSize?

> `optional` **pickTrayByPDFSize**: `boolean`

Defined in: [src/metadata/viewerPreferences.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L71)

Whether to pick the paper tray based on the PDF page size.

***

### printPageRange?

> `optional` **printPageRange**: \[`number`, `number`\][]

Defined in: [src/metadata/viewerPreferences.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L67)

Page ranges to print, as [start, end] pairs (1-based).

***

### printScaling?

> `optional` **printScaling**: `"None"` \| `"AppDefault"`

Defined in: [src/metadata/viewerPreferences.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/viewerPreferences.ts#L63)

Page scaling preference for the print dialog.
