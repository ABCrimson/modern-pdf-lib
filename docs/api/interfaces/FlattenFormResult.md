[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FlattenFormResult

# Interface: FlattenFormResult

Defined in: [src/form/formFlatten.ts:1053](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1053)

Result of a form flatten operation.

Contains the content stream operators and XObject resources that
must be applied to the page(s) to complete the flattening.

## Properties

### acroFormRemoved

```ts
acroFormRemoved: boolean;
```

Defined in: [src/form/formFlatten.ts:1063](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1063)

Whether the AcroForm was fully removed (all fields flattened).

***

### contentOps

```ts
contentOps: string;
```

Defined in: [src/form/formFlatten.ts:1055](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1055)

Content stream operators to append to the page.

***

### flattenedFields

```ts
flattenedFields: string[];
```

Defined in: [src/form/formFlatten.ts:1059](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1059)

Names of fields that were flattened.

***

### skippedFields

```ts
skippedFields: string[];
```

Defined in: [src/form/formFlatten.ts:1061](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1061)

Names of fields that were skipped (e.g. read-only with preserveReadOnly).

***

### xObjects

```ts
xObjects: object[];
```

Defined in: [src/form/formFlatten.ts:1057](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1057)

XObject name-to-stream pairs to add to page resources.

#### name

```ts
name: string;
```

#### stream

```ts
stream: PdfStream;
```
