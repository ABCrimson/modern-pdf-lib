[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / downloadCrl

# Function: downloadCrl()

```ts
function downloadCrl(url): Promise<CrlData>;
```

Defined in: [src/signature/crl.ts:290](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/crl.ts#L290)

Download and parse a CRL from a URL.

Uses `fetch()` to retrieve the CRL and then parses it as DER.
If the response is PEM-encoded, it is automatically converted to DER.

## Parameters

### url

`string`

URL of the CRL (typically an HTTP URL from CRL Distribution Points).

## Returns

`Promise`\&lt;`CrlData`\&gt;

Parsed CRL data.
