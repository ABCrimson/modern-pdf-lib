[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Invoice

# Interface: Invoice

Defined in: [src/compliance/facturX.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L63)

A complete invoice ready to be rendered as CII XML.

## Properties

### buyer

```ts
readonly buyer: InvoiceParty;
```

Defined in: [src/compliance/facturX.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L73)

Buyer trade party.

***

### currency

```ts
readonly currency: string;
```

Defined in: [src/compliance/facturX.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L69)

ISO 4217 currency code (e.g. 'EUR').

***

### invoiceNumber

```ts
readonly invoiceNumber: string;
```

Defined in: [src/compliance/facturX.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L65)

Invoice document number (BT-1).

***

### issueDate

```ts
readonly issueDate: string;
```

Defined in: [src/compliance/facturX.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L67)

Issue date as an ISO date string ('YYYY-MM-DD').

***

### lines

```ts
readonly lines: readonly InvoiceLine[];
```

Defined in: [src/compliance/facturX.ts:75](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L75)

Invoice line items.

***

### seller

```ts
readonly seller: InvoiceParty;
```

Defined in: [src/compliance/facturX.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L71)

Seller trade party.
