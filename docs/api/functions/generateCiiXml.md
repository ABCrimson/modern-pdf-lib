[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateCiiXml

# Function: generateCiiXml()

> **generateCiiXml**(`invoice`, `profile?`): `string`

Defined in: src/compliance/facturX.ts:300

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
