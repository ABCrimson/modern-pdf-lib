[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AppearanceProviderFor

# Type Alias: AppearanceProviderFor\&lt;T\&gt;

```ts
type AppearanceProviderFor<T> = T extends "text" ? (options) => PdfStream : T extends "checkbox" ? (options) => PdfStream : T extends "radio" ? (options) => PdfStream : T extends "dropdown" ? (options) => PdfStream : T extends "listbox" ? (options) => PdfStream : T extends "button" ? (options) => PdfStream : T extends "signature" ? (options) => PdfStream : never;
```

Defined in: [src/form/fieldAppearance.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldAppearance.ts#L37)

A typed function that generates an appearance stream for a specific
field type. Use this as a callback type when providing custom
appearance generators.

```ts
const myTextProvider: AppearanceProviderFor<'text'> = (opts) => {
  // custom rendering logic
  return myStream;
};
```

## Type Parameters

### T

`T` *extends* [`FieldType`](FieldType.md)
