[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateOrderX

# Function: generateOrderX()

> **generateOrderX**(`invoice`, `orderType`): `string`

Defined in: src/compliance/xRechnung.ts:409

Generate an Order-X CII order document (Order, OrderChange or
OrderResponse) from the shared [Invoice](../interfaces/Invoice.md) data model.

The document is built on the UN/CEFACT SCRDMCCBDACIOMessageStructure
(Cross Industry Order) schema, carries the Order-X guideline URN
(`urn:order-x.eu:1p0:basic`) and the UNTDID 1001 document type code
appropriate for the requested [OrderXType](../type-aliases/OrderXType.md) (220 Order / 230
OrderChange / 231 OrderResponse).

## Parameters

### invoice

[`Invoice`](../interfaces/Invoice.md)

The order data (reusing the shared [Invoice](../interfaces/Invoice.md) model).

### orderType

[`OrderXType`](../type-aliases/OrderXType.md)

The kind of Order-X document to produce.

## Returns

`string`

A well-formed Order-X CII XML document string.
