[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDssDictionary

# Function: buildDssDictionary()

> **buildDssDictionary**(`data`): `string`

Defined in: [src/signature/ltvEmbed.ts:146](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/ltvEmbed.ts#L146)

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
