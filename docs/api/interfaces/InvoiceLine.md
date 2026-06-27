[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvoiceLine

# Interface: InvoiceLine

Defined in: [src/compliance/facturX.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L51)

A single invoice line item.

## Properties

### description

```ts
readonly description: string;
```

Defined in: [src/compliance/facturX.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L53)

Free-text description of the goods or services.

***

### quantity

```ts
readonly quantity: number;
```

Defined in: [src/compliance/facturX.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L55)

Billed quantity.

***

### taxPercent

```ts
readonly taxPercent: number;
```

Defined in: [src/compliance/facturX.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L59)

VAT rate applied to this line, in percent (e.g. 19 for 19%).

***

### unitPrice

```ts
readonly unitPrice: number;
```

Defined in: [src/compliance/facturX.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L57)

Net unit price (excluding tax) in the invoice currency.
