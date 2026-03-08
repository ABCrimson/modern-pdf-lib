[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedLtvData

# Function: embedLtvData()

> **embedLtvData**(`pdf`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/signature/ltvEmbed.ts:200](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/ltvEmbed.ts#L200)

Embed LTV (Long-Term Validation) data into a PDF.

Extracts certificates from existing signatures, then appends a
Document Security Store (/DSS) dictionary to the PDF catalog via
incremental update.  The DSS contains the certificate chains,
OCSP responses, and CRLs needed for future verification.

## Parameters

### pdf

`Uint8Array`

The PDF bytes.

### options?

[`LtvOptions`](../interfaces/LtvOptions.md)

LTV embedding options.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The PDF with embedded LTV data.

## Example

```ts
import { embedLtvData } from 'modern-pdf-lib/signature';

const ltvPdf = await embedLtvData(signedPdf, {
  includeOcsp: true,
  includeCrl: true,
  includeCerts: true,
});
```
