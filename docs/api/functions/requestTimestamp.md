[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / requestTimestamp

# Function: requestTimestamp()

```ts
function requestTimestamp(
   dataHash, 
   tsaUrl, 
hashAlgorithm?): Promise<TimestampResult>;
```

Defined in: [src/signature/timestamp.ts:316](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/timestamp.ts#L316)

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

`"SHA-256"` \| `"SHA-384"` \| `"SHA-512"`

The hash algorithm. Default 'SHA-256'.

## Returns

`Promise`\&lt;[`TimestampResult`](../interfaces/TimestampResult.md)\&gt;

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
