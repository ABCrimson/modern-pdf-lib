[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CollectionOptions

# Interface: CollectionOptions

Defined in: [src/core/collections.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L69)

Options controlling the generated `/Collection` dictionary.

## Properties

### initialDocument?

```ts
readonly optional initialDocument?: string;
```

Defined in: [src/core/collections.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L83)

Name (in the `EmbeddedFiles` name tree) of the file to present first
(`/D`).

***

### schema?

```ts
readonly optional schema?: readonly CollectionSchemaField[];
```

Defined in: [src/core/collections.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L73)

Schema fields describing the columns / metadata of each embedded file.

***

### sortKeys?

```ts
readonly optional sortKeys?: readonly string[];
```

Defined in: [src/core/collections.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L78)

One or more schema keys used to sort the file list initially.
A single key serializes `/S` as a name; multiple keys as an array.

***

### view?

```ts
readonly optional view?: CollectionView;
```

Defined in: [src/core/collections.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L71)

Initial view mode; defaults to `'D'` (Details).
