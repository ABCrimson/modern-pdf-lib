[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EnforcePdfAOptions

# Interface: EnforcePdfAOptions

Defined in: [src/compliance/enforcePdfAv2.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L31)

Options for the enhanced PDF/A enforcement pipeline.

## Properties

### addFileId?

```ts
readonly optional addFileId?: boolean;
```

Defined in: [src/compliance/enforcePdfAv2.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L39)

Whether to add file ID. Default: true.

***

### addXmpMetadata?

```ts
readonly optional addXmpMetadata?: boolean;
```

Defined in: [src/compliance/enforcePdfAv2.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L37)

Whether to add XMP metadata. Default: true.

***

### author?

```ts
readonly optional author?: string;
```

Defined in: [src/compliance/enforcePdfAv2.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L43)

Document author for XMP metadata.

***

### flattenTransparency?

```ts
readonly optional flattenTransparency?: boolean;
```

Defined in: [src/compliance/enforcePdfAv2.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L35)

Whether to flatten transparency for PDF/A-1. Default: true.

***

### language?

```ts
readonly optional language?: string;
```

Defined in: [src/compliance/enforcePdfAv2.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L45)

Document language. Default: 'en'.

***

### stripProhibited?

```ts
readonly optional stripProhibited?: boolean;
```

Defined in: [src/compliance/enforcePdfAv2.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L33)

Whether to strip JavaScript and other prohibited actions. Default: true.

***

### title?

```ts
readonly optional title?: string;
```

Defined in: [src/compliance/enforcePdfAv2.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/enforcePdfAv2.ts#L41)

Document title for XMP metadata.
