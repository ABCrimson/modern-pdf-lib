[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FlattenOptions

# Interface: FlattenOptions

Defined in: [src/form/formFlatten.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/formFlatten.ts#L36)

Options for form flattening operations.

## Properties

### preserveReadOnly?

```ts
optional preserveReadOnly?: boolean;
```

Defined in: [src/form/formFlatten.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/formFlatten.ts#L43)

If `true`, read-only fields are skipped and left interactive.
All other fields are flattened normally.

Default: `false` (all fields are flattened, including read-only ones).

***

### preserveRichText?

```ts
optional preserveRichText?: boolean;
```

Defined in: [src/form/formFlatten.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/formFlatten.ts#L55)

If `true`, use /RV rich text value when available instead of /V.
Rich text (/RV) is an XHTML string containing formatting such as
bold, italic, font-size, color, and font-family. When enabled,
the flattener parses the XHTML and generates an appearance stream
that preserves the rich text styling. If parsing fails, the
flattener falls back to the plain text /V value.

Default: `true`.
