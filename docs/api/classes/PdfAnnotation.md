[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfAnnotation

# Class: PdfAnnotation

Defined in: [src/annotation/pdfAnnotation.ts:235](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L235)

Base class for all PDF annotations.

Wraps a PdfDict representing the annotation dictionary.  Subclasses
add type-specific getters/setters.

## Extended by

- [`PdfTextAnnotation`](PdfTextAnnotation.md)
- [`PdfLinkAnnotation`](PdfLinkAnnotation.md)
- [`PdfFreeTextAnnotation`](PdfFreeTextAnnotation.md)
- [`PdfHighlightAnnotation`](PdfHighlightAnnotation.md)
- [`PdfUnderlineAnnotation`](PdfUnderlineAnnotation.md)
- [`PdfSquigglyAnnotation`](PdfSquigglyAnnotation.md)
- [`PdfStrikeOutAnnotation`](PdfStrikeOutAnnotation.md)
- [`PdfLineAnnotation`](PdfLineAnnotation.md)
- [`PdfSquareAnnotation`](PdfSquareAnnotation.md)
- [`PdfCircleAnnotation`](PdfCircleAnnotation.md)
- [`PdfPolygonAnnotation`](PdfPolygonAnnotation.md)
- [`PdfPolyLineAnnotation`](PdfPolyLineAnnotation.md)
- [`PdfStampAnnotation`](PdfStampAnnotation.md)
- [`PdfInkAnnotation`](PdfInkAnnotation.md)
- [`PdfRedactAnnotation`](PdfRedactAnnotation.md)
- [`PdfPopupAnnotation`](PdfPopupAnnotation.md)
- [`PdfCaretAnnotation`](PdfCaretAnnotation.md)
- [`PdfFileAttachmentAnnotation`](PdfFileAttachmentAnnotation.md)

## Constructors

### Constructor

```ts
new PdfAnnotation(type, dict): PdfAnnotation;
```

Defined in: [src/annotation/pdfAnnotation.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L242)

#### Parameters

##### type

[`AnnotationType`](../type-aliases/AnnotationType.md)

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfAnnotation`

## Properties

### annotationType

```ts
readonly annotationType: AnnotationType;
```

Defined in: [src/annotation/pdfAnnotation.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L237)

The annotation subtype.

***

### dict

```ts
protected dict: PdfDict;
```

Defined in: [src/annotation/pdfAnnotation.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L240)

The underlying annotation dictionary.

## Methods

### generateAppearance()

```ts
generateAppearance(): PdfStream | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:450](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L450)

Generate an appearance stream for this annotation.

The base implementation returns `undefined`.  Subclasses override
to produce proper visual appearance.

#### Returns

[`PdfStream`](PdfStream.md) \| `undefined`

A PdfStream for the /AP /N entry, or undefined.

***

### getAuthor()

```ts
getAuthor(): string | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L303)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

***

### getColor()

```ts
getColor(): 
  | {
  b: number;
  g: number;
  r: number;
}
  | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:321](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L321)

Get the annotation colour.

#### Returns

  \| \&#123;
  `b`: `number`;
  `g`: `number`;
  `r`: `number`;
\&#125;
  \| `undefined`

***

### getContents()

```ts
getContents(): string | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:285](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L285)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

***

### getOpacity()

```ts
getOpacity(): number;
```

Defined in: [src/annotation/pdfAnnotation.ts:343](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L343)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

***

### getRect()

```ts
getRect(): [number, number, number, number];
```

Defined in: [src/annotation/pdfAnnotation.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L261)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

***

### getType()

```ts
getType(): AnnotationType;
```

Defined in: [src/annotation/pdfAnnotation.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L252)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

***

### isHidden()

```ts
isHidden(): boolean;
```

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation is hidden.

#### Returns

`boolean`

***

### isLocked()

```ts
isLocked(): boolean;
```

Defined in: [src/annotation/pdfAnnotation.ts:411](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L411)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

***

### isPrintable()

```ts
isPrintable(): boolean;
```

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation should be printed.

#### Returns

`boolean`

***

### setAuthor()

```ts
setAuthor(author): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L312)

Set the author.

#### Parameters

##### author

`string`

#### Returns

`void`

***

### setColor()

```ts
setColor(color): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:334](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L334)

Set the annotation colour.

#### Parameters

##### color

###### b

`number`

###### g

`number`

###### r

`number`

#### Returns

`void`

***

### setContents()

```ts
setContents(contents): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:294](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L294)

Set the text contents.

#### Parameters

##### contents

`string`

#### Returns

`void`

***

### setHidden()

```ts
setHidden(hidden): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L396)

Set the hidden flag.

#### Parameters

##### hidden

`boolean`

#### Returns

`void`

***

### setLocked()

```ts
setLocked(locked): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:416](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L416)

Set the locked flag.

#### Parameters

##### locked

`boolean`

#### Returns

`void`

***

### setOpacity()

```ts
setOpacity(opacity): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:352](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L352)

Set the annotation opacity.

#### Parameters

##### opacity

`number`

#### Returns

`void`

***

### setPrintable()

```ts
setPrintable(printable): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L406)

Set the print flag.

#### Parameters

##### printable

`boolean`

#### Returns

`void`

***

### setRect()

```ts
setRect(rect): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L276)

Set the annotation rectangle.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

#### Returns

`void`

***

### toDict()

```ts
toDict(registry): PdfDict;
```

Defined in: [src/annotation/pdfAnnotation.ts:430](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L430)

Convert this annotation to a PdfDict suitable for embedding in a PDF.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

The object registry (used to register sub-objects).

#### Returns

[`PdfDict`](PdfDict.md)

The annotation dictionary.
