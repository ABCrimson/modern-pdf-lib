[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ParsedPage

# Interface: ParsedPage

Defined in: [src/parser/streamingParser.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L50)

A page extracted from the streaming parse — contains structural
metadata (boxes, rotation) and the byte-range location of its
content stream within the PDF data, but *not* the content bytes
themselves.

## Properties

### contentStreamLength

```ts
contentStreamLength: number;
```

Defined in: [src/parser/streamingParser.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L62)

Length of the content stream in bytes.

***

### contentStreamOffset

```ts
contentStreamOffset: number;
```

Defined in: [src/parser/streamingParser.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L60)

Byte offset of the content stream within the PDF data.

***

### cropBox?

```ts
optional cropBox?: [number, number, number, number];
```

Defined in: [src/parser/streamingParser.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L56)

The /CropBox rectangle (if present).

***

### index

```ts
index: number;
```

Defined in: [src/parser/streamingParser.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L52)

Zero-based page index.

***

### mediaBox

```ts
mediaBox: [number, number, number, number];
```

Defined in: [src/parser/streamingParser.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L54)

The /MediaBox rectangle.

***

### resourcesOffset?

```ts
optional resourcesOffset?: number;
```

Defined in: [src/parser/streamingParser.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L64)

Byte offset of the /Resources dictionary (if resolvable).

***

### rotation?

```ts
optional rotation?: number;
```

Defined in: [src/parser/streamingParser.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L58)

Page rotation in degrees (0, 90, 180, 270).
