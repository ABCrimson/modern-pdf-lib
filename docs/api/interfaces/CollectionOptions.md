[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CollectionOptions

# Interface: CollectionOptions

Defined in: src/core/collections.ts:69

Options controlling the generated `/Collection` dictionary.

## Properties

### initialDocument?

> `readonly` `optional` **initialDocument?**: `string`

Defined in: src/core/collections.ts:83

Name (in the `EmbeddedFiles` name tree) of the file to present first
(`/D`).

***

### schema?

> `readonly` `optional` **schema?**: readonly [`CollectionSchemaField`](CollectionSchemaField.md)[]

Defined in: src/core/collections.ts:73

Schema fields describing the columns / metadata of each embedded file.

***

### sortKeys?

> `readonly` `optional` **sortKeys?**: readonly `string`[]

Defined in: src/core/collections.ts:78

One or more schema keys used to sort the file list initially.
A single key serializes `/S` as a name; multiple keys as an array.

***

### view?

> `readonly` `optional` **view?**: [`CollectionView`](../type-aliases/CollectionView.md)

Defined in: src/core/collections.ts:71

Initial view mode; defaults to `'D'` (Details).
