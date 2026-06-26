[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvoiceParty

# Interface: InvoiceParty

Defined in: src/compliance/facturX.ts:41

A trading party (seller or buyer) on the invoice.

## Properties

### countryCode

> `readonly` **countryCode**: `string`

Defined in: src/compliance/facturX.ts:45

ISO 3166-1 alpha-2 country code (e.g. 'DE', 'FR').

***

### name

> `readonly` **name**: `string`

Defined in: src/compliance/facturX.ts:43

Legal/trading name of the party.

***

### vatId?

> `readonly` `optional` **vatId?**: `string`

Defined in: src/compliance/facturX.ts:47

VAT registration identifier, if any (e.g. 'DE123456789').
