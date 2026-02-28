[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AppearanceProviderFor

# Type Alias: AppearanceProviderFor\<T\>

> **AppearanceProviderFor**\<`T`\> = `T` *extends* `"text"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"checkbox"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"radio"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"dropdown"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"listbox"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"button"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"signature"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `never`

Defined in: [src/form/fieldAppearance.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/form/fieldAppearance.ts#L38)

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
