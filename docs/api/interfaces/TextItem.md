[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextItem

# Interface: TextItem

Defined in: [src/parser/textExtractor.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L31)

A single extracted text item with position and font information.

## Properties

### fontName

```ts
fontName: string;
```

Defined in: [src/parser/textExtractor.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L45)

Font resource name (e.g. `"/F1"`).

***

### fontSize

```ts
fontSize: number;
```

Defined in: [src/parser/textExtractor.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L43)

Font size in user-space units.

***

### height

```ts
height: number;
```

Defined in: [src/parser/textExtractor.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L41)

Approximate height of the text in user-space units (based on font size).

***

### text

```ts
text: string;
```

Defined in: [src/parser/textExtractor.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L33)

The extracted text string.

***

### width

```ts
width: number;
```

Defined in: [src/parser/textExtractor.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L39)

Approximate width of the text in user-space units.

***

### x

```ts
x: number;
```

Defined in: [src/parser/textExtractor.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L35)

Horizontal position in user-space units.

***

### y

```ts
y: number;
```

Defined in: [src/parser/textExtractor.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textExtractor.ts#L37)

Vertical position in user-space units.
