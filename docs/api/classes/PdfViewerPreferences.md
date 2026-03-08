[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfViewerPreferences

# Class: PdfViewerPreferences

Defined in: [src/metadata/pdfViewerPreferences.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L26)

Class-based API for PDF viewer preferences with individual getter/setter pairs.

Provides the same functionality as the plain `ViewerPreferences` interface
but with a more discoverable, pdf-lib-compatible API.

```ts
const prefs = doc.getViewerPreferences();
prefs.setHideToolbar(true);
prefs.setDisplayDocTitle(true);
prefs.setPrintScaling('None');
```

## Constructors

### Constructor

> **new PdfViewerPreferences**(`data?`): `PdfViewerPreferences`

Defined in: [src/metadata/pdfViewerPreferences.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L29)

#### Parameters

##### data?

[`ViewerPreferences`](../interfaces/ViewerPreferences.md) = `{}`

#### Returns

`PdfViewerPreferences`

## Methods

### getCenterWindow()

> **getCenterWindow**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L56)

Whether the document window should be centered on the screen.

#### Returns

`boolean`

***

### getDirection()

> **getDirection**(): `"L2R"` \| `"R2L"`

Defined in: [src/metadata/pdfViewerPreferences.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L82)

Predominant reading order for text.

#### Returns

`"L2R"` \| `"R2L"`

***

### getDisplayDocTitle()

> **getDisplayDocTitle**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L61)

Whether the title bar should display the document title from metadata.

#### Returns

`boolean`

***

### getDuplex()

> **getDuplex**(): `"Simplex"` \| `"DuplexFlipShortEdge"` \| `"DuplexFlipLongEdge"` \| `undefined`

Defined in: [src/metadata/pdfViewerPreferences.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L100)

Paper handling option for duplex printing, or undefined if not set.

#### Returns

`"Simplex"` \| `"DuplexFlipShortEdge"` \| `"DuplexFlipLongEdge"` \| `undefined`

***

### getFitWindow()

> **getFitWindow**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L51)

Whether the document window should be resized to fit the first page.

#### Returns

`boolean`

***

### getHideMenubar()

> **getHideMenubar**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L41)

Whether the viewer's menu bar should be hidden.

#### Returns

`boolean`

***

### getHideToolbar()

> **getHideToolbar**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L36)

Whether the viewer's toolbar should be hidden.

#### Returns

`boolean`

***

### getHideWindowUI()

> **getHideWindowUI**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L46)

Whether the viewer's window UI elements should be hidden.

#### Returns

`boolean`

***

### getNonFullScreenPageMode()

> **getNonFullScreenPageMode**(): `"UseNone"` \| `"UseOutlines"` \| `"UseThumbs"` \| `"UseOC"`

Defined in: [src/metadata/pdfViewerPreferences.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L73)

Page mode to use when exiting full-screen mode.

#### Returns

`"UseNone"` \| `"UseOutlines"` \| `"UseThumbs"` \| `"UseOC"`

***

### getNumCopies()

> **getNumCopies**(): `number`

Defined in: [src/metadata/pdfViewerPreferences.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L111)

Default number of copies to print.

#### Returns

`number`

***

### getPickTrayByPDFSize()

> **getPickTrayByPDFSize**(): `boolean`

Defined in: [src/metadata/pdfViewerPreferences.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L66)

Whether the paper tray should be selected based on the PDF page size.

#### Returns

`boolean`

***

### getPrintPageRange()

> **getPrintPageRange**(): \[`number`, `number`\][] \| `undefined`

Defined in: [src/metadata/pdfViewerPreferences.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L116)

Page ranges to print, as [start, end] pairs, or undefined if not set.

#### Returns

\[`number`, `number`\][] \| `undefined`

***

### getPrintScaling()

> **getPrintScaling**(): `"None"` \| `"AppDefault"`

Defined in: [src/metadata/pdfViewerPreferences.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L91)

Page scaling preference for the print dialog.

#### Returns

`"None"` \| `"AppDefault"`

***

### setCenterWindow()

> **setCenterWindow**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L58)

Set whether the document window should be centered on the screen.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setDirection()

> **setDirection**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L86)

Set the predominant reading order for text.

#### Parameters

##### value

`"L2R"` | `"R2L"`

#### Returns

`void`

***

### setDisplayDocTitle()

> **setDisplayDocTitle**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L63)

Set whether the title bar should display the document title.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setDuplex()

> **setDuplex**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L104)

Set the paper handling option for duplex printing.

#### Parameters

##### value

`"Simplex"` | `"DuplexFlipShortEdge"` | `"DuplexFlipLongEdge"`

#### Returns

`void`

***

### setFitWindow()

> **setFitWindow**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L53)

Set whether the document window should be resized to fit the first page.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setHideMenubar()

> **setHideMenubar**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L43)

Set whether the viewer's menu bar should be hidden.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setHideToolbar()

> **setHideToolbar**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L38)

Set whether the viewer's toolbar should be hidden.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setHideWindowUI()

> **setHideWindowUI**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L48)

Set whether the viewer's window UI elements should be hidden.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setNonFullScreenPageMode()

> **setNonFullScreenPageMode**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L77)

Set the page mode to use when exiting full-screen mode.

#### Parameters

##### value

`"UseNone"` | `"UseOutlines"` | `"UseThumbs"` | `"UseOC"`

#### Returns

`void`

***

### setNumCopies()

> **setNumCopies**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L113)

Set the default number of copies to print.

#### Parameters

##### value

`number`

#### Returns

`void`

***

### setPickTrayByPDFSize()

> **setPickTrayByPDFSize**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L68)

Set whether the paper tray should be selected based on the PDF page size.

#### Parameters

##### value

`boolean`

#### Returns

`void`

***

### setPrintPageRange()

> **setPrintPageRange**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L118)

Set the page ranges to print, as [start, end] pairs.

#### Parameters

##### value

\[`number`, `number`\][]

#### Returns

`void`

***

### setPrintScaling()

> **setPrintScaling**(`value`): `void`

Defined in: [src/metadata/pdfViewerPreferences.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L95)

Set the page scaling preference for the print dialog.

#### Parameters

##### value

`"None"` | `"AppDefault"`

#### Returns

`void`

***

### toDict()

> **toDict**(): [`PdfDict`](PdfDict.md)

Defined in: [src/metadata/pdfViewerPreferences.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L123)

Convert to a PdfDict for embedding in the PDF catalog.

#### Returns

[`PdfDict`](PdfDict.md)

***

### toObject()

> **toObject**(): [`ViewerPreferences`](../interfaces/ViewerPreferences.md)

Defined in: [src/metadata/pdfViewerPreferences.ts:126](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/pdfViewerPreferences.ts#L126)

Convert to a plain ViewerPreferences object.

#### Returns

[`ViewerPreferences`](../interfaces/ViewerPreferences.md)
