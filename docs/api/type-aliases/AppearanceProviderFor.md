[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AppearanceProviderFor

# Type Alias: AppearanceProviderFor\<T\>

> **AppearanceProviderFor**\<`T`\> = `T` *extends* `"text"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"checkbox"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"radio"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"dropdown"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"listbox"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"button"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `T` *extends* `"signature"` ? (`options`) => [`PdfStream`](../classes/PdfStream.md) : `never`

Defined in: [src/form/fieldAppearance.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/form/fieldAppearance.ts#L38)

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
