[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbeddedFile

# Interface: EmbeddedFile

Defined in: [src/core/embeddedFiles.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L31)

Describes a file to attach to (or already attached to) a PDF.

## Properties

### creationDate?

```ts
optional creationDate?: Date;
```

Defined in: [src/core/embeddedFiles.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L41)

Optional creation date.

***

### data

```ts
data: Uint8Array;
```

Defined in: [src/core/embeddedFiles.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L35)

File data.

***

### description?

```ts
optional description?: string;
```

Defined in: [src/core/embeddedFiles.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L39)

Optional description.

***

### mimeType

```ts
mimeType: string;
```

Defined in: [src/core/embeddedFiles.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L37)

MIME type (e.g. `"application/pdf"`, `"text/plain"`).

***

### modificationDate?

```ts
optional modificationDate?: Date;
```

Defined in: [src/core/embeddedFiles.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L43)

Optional modification date.

***

### name

```ts
name: string;
```

Defined in: [src/core/embeddedFiles.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/embeddedFiles.ts#L33)

Filename.
