[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfAXmpOptions

# Interface: PdfAXmpOptions

Defined in: [src/compliance/xmpGenerator.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L32)

Options for generating PDF/A XMP metadata.

## Properties

### author?

```ts
readonly optional author?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L40)

Document author.

***

### conformance

```ts
readonly conformance: string;
```

Defined in: [src/compliance/xmpGenerator.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L36)

PDF/A conformance level ('A', 'B', or 'U').

***

### createDate?

```ts
readonly optional createDate?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L50)

Creation date (ISO 8601). Default: current date.

***

### creatorTool?

```ts
readonly optional creatorTool?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L46)

Creator tool name. Default: 'modern-pdf-lib'.

***

### keywords?

```ts
readonly optional keywords?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L44)

Keywords.

***

### language?

```ts
readonly optional language?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L54)

Document language (BCP 47). Default: 'en'.

***

### modifyDate?

```ts
readonly optional modifyDate?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L52)

Modification date (ISO 8601). Default: current date.

***

### part

```ts
readonly part: number;
```

Defined in: [src/compliance/xmpGenerator.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L34)

PDF/A part number (1, 2, or 3).

***

### producer?

```ts
readonly optional producer?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L48)

PDF producer name. Default: 'modern-pdf-lib'.

***

### subject?

```ts
readonly optional subject?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L42)

Document subject/description.

***

### title?

```ts
readonly optional title?: string;
```

Defined in: [src/compliance/xmpGenerator.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/xmpGenerator.ts#L38)

Document title.
