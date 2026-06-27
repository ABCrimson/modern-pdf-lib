[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TrailerInfo

# Interface: TrailerInfo

Defined in: [src/signature/incrementalSave.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L71)

Information extracted from an existing PDF trailer.

## Properties

### infoRef?

```ts
optional infoRef?: string;
```

Defined in: [src/signature/incrementalSave.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L77)

The /Info reference string (e.g., "4 0 R"), if present.

***

### prevXrefOffset

```ts
prevXrefOffset: number;
```

Defined in: [src/signature/incrementalSave.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L79)

The byte offset of the previous cross-reference section.

***

### rootRef

```ts
rootRef: string;
```

Defined in: [src/signature/incrementalSave.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L75)

The /Root reference string (e.g., "1 0 R").

***

### size

```ts
size: number;
```

Defined in: [src/signature/incrementalSave.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/incrementalSave.ts#L73)

The /Size value (total number of objects).
