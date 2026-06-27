[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LoadPdfOptions

# Interface: LoadPdfOptions

Defined in: [src/parser/documentParser.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L51)

Options for loading a PDF document from bytes.

## Properties

### capNumbers?

```ts
optional capNumbers?: boolean;
```

Defined in: [src/parser/documentParser.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L80)

When `true`, clamp extreme floating-point values (very large or
very small numbers) to safe ranges during parsing. This prevents
numeric overflows from producing garbage output.

Default: `false`.

***

### ignoreEncryption?

```ts
optional ignoreEncryption?: boolean;
```

Defined in: [src/parser/documentParser.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L55)

When true, skip decryption even if the PDF is encrypted.

***

### objectsPerTick?

```ts
optional objectsPerTick?: number;
```

Defined in: [src/parser/documentParser.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L66)

Number of objects to process per event-loop tick during parsing.
Lower values keep the main thread more responsive in browsers.
Defaults to `Infinity` (no throttling).

***

### password?

```ts
optional password?: string;
```

Defined in: [src/parser/documentParser.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L53)

Password for encrypted PDFs (Phase 5).

***

### throwOnInvalidObject?

```ts
optional throwOnInvalidObject?: boolean;
```

Defined in: [src/parser/documentParser.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L72)

When `true`, throw an error if a malformed or invalid PDF object
is encountered during parsing. When `false` (default), malformed
objects are silently skipped.

***

### updateMetadata?

```ts
optional updateMetadata?: boolean;
```

Defined in: [src/parser/documentParser.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/documentParser.ts#L60)

When true, update the /ModDate in the /Info dictionary to the
current time when saving. Defaults to true.
