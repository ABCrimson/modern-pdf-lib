[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CollectionSchemaField

# Interface: CollectionSchemaField

Defined in: [src/core/collections.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L51)

One field of a collection schema (ISO 32000-2, Table 44 "Entries in a
collection field dictionary").

## Properties

### fieldType

```ts
readonly fieldType: "S" | "D" | "N";
```

Defined in: [src/core/collections.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L63)

Field data type (`/Subtype`):

- `'S'` — text string.
- `'D'` — date.
- `'N'` — number.

***

### key

```ts
readonly key: string;
```

Defined in: [src/core/collections.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L53)

Schema key — the name under which the subfield dict is stored in `/Schema`.

***

### label

```ts
readonly label: string;
```

Defined in: [src/core/collections.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L55)

Human-readable column label (`/N`).

***

### order?

```ts
readonly optional order?: number;
```

Defined in: [src/core/collections.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/collections.ts#L65)

Optional relative column order (`/O`); lower sorts first.
