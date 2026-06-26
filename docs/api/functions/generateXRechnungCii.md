[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateXRechnungCii

# Function: generateXRechnungCii()

```ts
function generateXRechnungCii(invoice, options?): string;
```

Defined in: [src/compliance/xRechnung.ts:315](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/xRechnung.ts#L315)

Generate an XRechnung 3.x CII (Cross Industry Invoice) XML document.

The document carries the KoSIT XRechnung guideline URN
(`urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0`)
and, when a Leitweg-ID is supplied, the mandatory BT-DE-15 BuyerReference.

## Parameters

### invoice

[`Invoice`](../interfaces/Invoice.md)

The invoice data (shared [Invoice](../interfaces/Invoice.md) model).

### options?

[`XRechnungOptions`](../interfaces/XRechnungOptions.md) = `{}`

XRechnung-specific options (Leitweg-ID, buyer reference).

## Returns

`string`

A well-formed CII XML document string.
