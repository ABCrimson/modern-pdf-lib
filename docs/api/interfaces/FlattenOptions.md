[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FlattenOptions

# Interface: FlattenOptions

Defined in: src/form/formFlatten.ts:36

Options for form flattening operations.

## Properties

### preserveReadOnly?

> `optional` **preserveReadOnly**: `boolean`

Defined in: src/form/formFlatten.ts:43

If `true`, read-only fields are skipped and left interactive.
All other fields are flattened normally.

Default: `false` (all fields are flattened, including read-only ones).
