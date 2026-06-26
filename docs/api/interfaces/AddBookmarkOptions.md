[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AddBookmarkOptions

# Interface: AddBookmarkOptions

Defined in: [src/core/outlines.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L82)

Options for [addBookmark](../functions/addBookmark.md).

## Properties

### bold?

```ts
optional bold?: boolean;
```

Defined in: [src/core/outlines.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L98)

Whether the title text is bold.

***

### color?

```ts
optional color?: object;
```

Defined in: [src/core/outlines.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L102)

Colour of the bookmark title (RGB, 0-1 range).

#### b

```ts
b: number;
```

#### g

```ts
g: number;
```

#### r

```ts
r: number;
```

***

### fit?

```ts
optional fit?: "Fit" | "FitH" | "FitV" | "FitB" | "FitBH" | "FitBV" | "XYZ";
```

Defined in: [src/core/outlines.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L92)

Page fit mode. Default: `'Fit'` (or `'FitH'` when only `y` is set).

***

### isOpen?

```ts
optional isOpen?: boolean;
```

Defined in: [src/core/outlines.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L107)

Whether the bookmark's children are initially expanded.
Default: `true`.

***

### italic?

```ts
optional italic?: boolean;
```

Defined in: [src/core/outlines.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L100)

Whether the title text is italic.

***

### left?

```ts
optional left?: number;
```

Defined in: [src/core/outlines.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L94)

Left coordinate (for FitV, FitBV, XYZ).

***

### pageIndex

```ts
pageIndex: number;
```

Defined in: [src/core/outlines.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L86)

Zero-based page index to navigate to.

***

### parent?

```ts
optional parent?: BookmarkRef;
```

Defined in: [src/core/outlines.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L88)

Parent bookmark for nesting.  Omit for a top-level bookmark.

***

### title

```ts
title: string;
```

Defined in: [src/core/outlines.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L84)

The display title for the bookmark.

***

### y?

```ts
optional y?: number;
```

Defined in: [src/core/outlines.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L90)

Vertical position on the page (top coordinate for FitH, FitBH, XYZ).

***

### zoom?

```ts
optional zoom?: number;
```

Defined in: [src/core/outlines.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/outlines.ts#L96)

Zoom factor (for XYZ). 0 = keep current zoom.
