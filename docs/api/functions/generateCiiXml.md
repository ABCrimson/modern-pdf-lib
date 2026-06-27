[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateCiiXml

# Function: generateCiiXml()

```ts
function generateCiiXml(invoice, profile?): string;
```

Defined in: [src/compliance/facturX.ts:300](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/facturX.ts#L300)

Generate a UN/CEFACT Cross Industry Invoice (CII) XML document for
the given invoice and Factur-X / ZUGFeRD profile.

The returned string is a well-formed XML document beginning with an
XML declaration and a `<rsm:CrossIndustryInvoice>` root element using
the standard `rsm`, `ram` and `udt` namespaces. All text values are
XML-escaped.

## Parameters

### invoice

[`Invoice`](../interfaces/Invoice.md)

The invoice data.

### profile?

[`FacturXProfile`](../type-aliases/FacturXProfile.md) = `'EN16931'`

The Factur-X / ZUGFeRD profile. Default: 'EN16931'.

## Returns

`string`

The CII XML document as a string.
