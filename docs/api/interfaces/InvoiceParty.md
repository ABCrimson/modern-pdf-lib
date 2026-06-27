[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvoiceParty

# Interface: InvoiceParty

Defined in: [src/compliance/facturX.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L41)

A trading party (seller or buyer) on the invoice.

## Properties

### countryCode

```ts
readonly countryCode: string;
```

Defined in: [src/compliance/facturX.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L45)

ISO 3166-1 alpha-2 country code (e.g. 'DE', 'FR').

***

### name

```ts
readonly name: string;
```

Defined in: [src/compliance/facturX.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L43)

Legal/trading name of the party.

***

### vatId?

```ts
readonly optional vatId?: string;
```

Defined in: [src/compliance/facturX.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L47)

VAT registration identifier, if any (e.g. 'DE123456789').
