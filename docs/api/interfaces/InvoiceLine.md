[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InvoiceLine

# Interface: InvoiceLine

Defined in: src/compliance/facturX.ts:51

A single invoice line item.

## Properties

### description

> `readonly` **description**: `string`

Defined in: src/compliance/facturX.ts:53

Free-text description of the goods or services.

***

### quantity

> `readonly` **quantity**: `number`

Defined in: src/compliance/facturX.ts:55

Billed quantity.

***

### taxPercent

> `readonly` **taxPercent**: `number`

Defined in: src/compliance/facturX.ts:59

VAT rate applied to this line, in percent (e.g. 19 for 19%).

***

### unitPrice

> `readonly` **unitPrice**: `number`

Defined in: src/compliance/facturX.ts:57

Net unit price (excluding tax) in the invoice currency.
