[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / requestTimestamp

# Function: requestTimestamp()

> **requestTimestamp**(`dataHash`, `tsaUrl`, `hashAlgorithm?`): `Promise`\<[`TimestampResult`](../interfaces/TimestampResult.md)\>

Defined in: [src/signature/timestamp.ts:318](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/timestamp.ts#L318)

Request a timestamp from an RFC 3161 TSA.

Sends a TimeStampReq via HTTP POST and parses the TimeStampResp.
Uses `fetch()` for universal runtime compatibility (Node.js 18+,
browsers, Deno, Bun, Cloudflare Workers).

## Parameters

### dataHash

`Uint8Array`

The hash of the data to timestamp.

### tsaUrl

`string`

The URL of the TSA service.

### hashAlgorithm?

The hash algorithm. Default 'SHA-256'.

`"SHA-256"` | `"SHA-384"` | `"SHA-512"`

## Returns

`Promise`\<[`TimestampResult`](../interfaces/TimestampResult.md)\>

The timestamp result.

## Throws

Error if the request fails or the TSA returns
                      an error status.

## Example

```ts
const hash = await computeSignatureHash(pdfBytes, byteRange);
const timestamp = await requestTimestamp(
  hash,
  'http://timestamp.digicert.com',
);
```
