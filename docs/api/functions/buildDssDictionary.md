[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDssDictionary

# Function: buildDssDictionary()

> **buildDssDictionary**(`data`): `string`

Defined in: [src/signature/ltvEmbed.ts:148](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/ltvEmbed.ts#L148)

Build a DSS (Document Security Store) dictionary string for
incremental append to a PDF.

The DSS dictionary contains:
- /Certs: array of stream references for certificates
- /OCSPs: array of stream references for OCSP responses
- /CRLs: array of stream references for CRLs

## Parameters

### data

[`DssData`](../interfaces/DssData.md)

The DSS data containing certs, OCSPs, and CRLs.

## Returns

`string`

A string representation of the DSS dictionary content.

## Example

```ts
const dssStr = buildDssDictionary({
  certs: [certDer1, certDer2],
  ocsps: [ocspResponse],
  crls: [crlDer],
});
```
