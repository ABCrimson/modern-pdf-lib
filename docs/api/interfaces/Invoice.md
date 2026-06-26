[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Invoice

# Interface: Invoice

Defined in: src/compliance/facturX.ts:63

A complete invoice ready to be rendered as CII XML.

## Properties

### buyer

> `readonly` **buyer**: [`InvoiceParty`](InvoiceParty.md)

Defined in: src/compliance/facturX.ts:73

Buyer trade party.

***

### currency

> `readonly` **currency**: `string`

Defined in: src/compliance/facturX.ts:69

ISO 4217 currency code (e.g. 'EUR').

***

### invoiceNumber

> `readonly` **invoiceNumber**: `string`

Defined in: src/compliance/facturX.ts:65

Invoice document number (BT-1).

***

### issueDate

> `readonly` **issueDate**: `string`

Defined in: src/compliance/facturX.ts:67

Issue date as an ISO date string ('YYYY-MM-DD').

***

### lines

> `readonly` **lines**: readonly [`InvoiceLine`](InvoiceLine.md)[]

Defined in: src/compliance/facturX.ts:75

Invoice line items.

***

### seller

> `readonly` **seller**: [`InvoiceParty`](InvoiceParty.md)

Defined in: src/compliance/facturX.ts:71

Seller trade party.
