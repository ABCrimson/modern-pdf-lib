[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CollectionSchemaField

# Interface: CollectionSchemaField

Defined in: src/core/collections.ts:51

One field of a collection schema (ISO 32000-2, Table 44 "Entries in a
collection field dictionary").

## Properties

### fieldType

> `readonly` **fieldType**: `"S"` \| `"D"` \| `"N"`

Defined in: src/core/collections.ts:63

Field data type (`/Subtype`):

- `'S'` — text string.
- `'D'` — date.
- `'N'` — number.

***

### key

> `readonly` **key**: `string`

Defined in: src/core/collections.ts:53

Schema key — the name under which the subfield dict is stored in `/Schema`.

***

### label

> `readonly` **label**: `string`

Defined in: src/core/collections.ts:55

Human-readable column label (`/N`).

***

### order?

> `readonly` `optional` **order?**: `number`

Defined in: src/core/collections.ts:65

Optional relative column order (`/O`); lower sorts first.
