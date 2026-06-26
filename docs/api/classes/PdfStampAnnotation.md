[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStampAnnotation

# Class: PdfStampAnnotation

Defined in: [src/annotation/types/stampAnnotation.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/types/stampAnnotation.ts#L49)

A stamp annotation (subtype /Stamp).

Displays a graphical stamp on the page, similar to a rubber stamp
applied to a physical document.

## Extends

- [`PdfAnnotation`](PdfAnnotation.md)

## Constructors

### Constructor

```ts
new PdfStampAnnotation(dict): PdfStampAnnotation;
```

Defined in: [src/annotation/types/stampAnnotation.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/types/stampAnnotation.ts#L50)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

#### Returns

`PdfStampAnnotation`

#### Overrides

[`PdfAnnotation`](PdfAnnotation.md).[`constructor`](PdfAnnotation.md#constructor)

## Properties

### annotationType

```ts
readonly annotationType: AnnotationType;
```

Defined in: [src/annotation/pdfAnnotation.ts:237](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L237)

The annotation subtype.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`annotationType`](PdfAnnotation.md#annotationtype)

***

### dict

```ts
protected dict: PdfDict;
```

Defined in: [src/annotation/pdfAnnotation.ts:240](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L240)

The underlying annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`dict`](PdfAnnotation.md#dict)

## Methods

### generateAppearance()

```ts
generateAppearance(): PdfStream | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:450](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L450)

Generate an appearance stream for this annotation.

The base implementation returns `undefined`.  Subclasses override
to produce proper visual appearance.

#### Returns

[`PdfStream`](PdfStream.md) \| `undefined`

A PdfStream for the /AP /N entry, or undefined.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`generateAppearance`](PdfAnnotation.md#generateappearance)

***

### getAuthor()

```ts
getAuthor(): string | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L303)

Get the author (PDF /T entry).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getAuthor`](PdfAnnotation.md#getauthor)

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

Defined in: [src/annotation/pdfAnnotation.ts:321](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L321)

Get the annotation colour.

#### Returns

  \| \&#123;
  `b`: `number`;
  `g`: `number`;
  `r`: `number`;
\&#125;
  \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getColor`](PdfAnnotation.md#getcolor)

***

### getContents()

```ts
getContents(): string | undefined;
```

Defined in: [src/annotation/pdfAnnotation.ts:285](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L285)

Get the text contents (tooltip / popup text).

#### Returns

`string` \| `undefined`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getContents`](PdfAnnotation.md#getcontents)

***

### getOpacity()

```ts
getOpacity(): number;
```

Defined in: [src/annotation/pdfAnnotation.ts:343](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L343)

Get the annotation opacity (0-1). Defaults to 1.

#### Returns

`number`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getOpacity`](PdfAnnotation.md#getopacity)

***

### getRect()

```ts
getRect(): [number, number, number, number];
```

Defined in: [src/annotation/pdfAnnotation.ts:261](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L261)

Get the annotation rectangle [x1, y1, x2, y2].

#### Returns

\[`number`, `number`, `number`, `number`\]

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getRect`](PdfAnnotation.md#getrect)

***

### getStampName()

```ts
getStampName(): string;
```

Defined in: [src/annotation/types/stampAnnotation.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/types/stampAnnotation.ts#L80)

Get the stamp name (e.g. 'Approved', 'Draft').

#### Returns

`string`

***

### getType()

```ts
getType(): AnnotationType;
```

Defined in: [src/annotation/pdfAnnotation.ts:252](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L252)

Get the annotation subtype.

#### Returns

[`AnnotationType`](../type-aliases/AnnotationType.md)

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`getType`](PdfAnnotation.md#gettype)

***

### isHidden()

```ts
isHidden(): boolean;
```

Defined in: [src/annotation/pdfAnnotation.ts:391](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L391)

Whether the annotation is hidden.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isHidden`](PdfAnnotation.md#ishidden)

***

### isLocked()

```ts
isLocked(): boolean;
```

Defined in: [src/annotation/pdfAnnotation.ts:411](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L411)

Whether the annotation is locked (cannot be moved/resized).

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isLocked`](PdfAnnotation.md#islocked)

***

### isPrintable()

```ts
isPrintable(): boolean;
```

Defined in: [src/annotation/pdfAnnotation.ts:401](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L401)

Whether the annotation should be printed.

#### Returns

`boolean`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`isPrintable`](PdfAnnotation.md#isprintable)

***

### setAuthor()

```ts
setAuthor(author): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:312](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L312)

Set the author.

#### Parameters

##### author

`string`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setAuthor`](PdfAnnotation.md#setauthor)

***

### setColor()

```ts
setColor(color): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:334](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L334)

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

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setColor`](PdfAnnotation.md#setcolor)

***

### setContents()

```ts
setContents(contents): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:294](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L294)

Set the text contents.

#### Parameters

##### contents

`string`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setContents`](PdfAnnotation.md#setcontents)

***

### setHidden()

```ts
setHidden(hidden): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:396](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L396)

Set the hidden flag.

#### Parameters

##### hidden

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setHidden`](PdfAnnotation.md#sethidden)

***

### setLocked()

```ts
setLocked(locked): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:416](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L416)

Set the locked flag.

#### Parameters

##### locked

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setLocked`](PdfAnnotation.md#setlocked)

***

### setOpacity()

```ts
setOpacity(opacity): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:352](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L352)

Set the annotation opacity.

#### Parameters

##### opacity

`number`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setOpacity`](PdfAnnotation.md#setopacity)

***

### setPrintable()

```ts
setPrintable(printable): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:406](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L406)

Set the print flag.

#### Parameters

##### printable

`boolean`

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setPrintable`](PdfAnnotation.md#setprintable)

***

### setRect()

```ts
setRect(rect): void;
```

Defined in: [src/annotation/pdfAnnotation.ts:276](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L276)

Set the annotation rectangle.

#### Parameters

##### rect

\[`number`, `number`, `number`, `number`\]

#### Returns

`void`

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`setRect`](PdfAnnotation.md#setrect)

***

### setStampName()

```ts
setStampName(name): void;
```

Defined in: [src/annotation/types/stampAnnotation.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/types/stampAnnotation.ts#L89)

Set the stamp name.

#### Parameters

##### name

`string`

#### Returns

`void`

***

### toDict()

```ts
toDict(registry): PdfDict;
```

Defined in: [src/annotation/pdfAnnotation.ts:430](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L430)

Convert this annotation to a PdfDict suitable for embedding in a PDF.

#### Parameters

##### registry

[`PdfObjectRegistry`](PdfObjectRegistry.md)

The object registry (used to register sub-objects).

#### Returns

[`PdfDict`](PdfDict.md)

The annotation dictionary.

#### Inherited from

[`PdfAnnotation`](PdfAnnotation.md).[`toDict`](PdfAnnotation.md#todict)

***

### create()

```ts
static create(options): PdfStampAnnotation;
```

Defined in: [src/annotation/types/stampAnnotation.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/types/stampAnnotation.ts#L57)

Create a new stamp annotation.

#### Parameters

##### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md) & `object`

#### Returns

`PdfStampAnnotation`

***

### fromDict()

```ts
static fromDict(dict, _resolver?): PdfStampAnnotation;
```

Defined in: [src/annotation/types/stampAnnotation.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/types/stampAnnotation.ts#L68)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

##### \_resolver?

(`ref`) =&gt; [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

#### Returns

`PdfStampAnnotation`
