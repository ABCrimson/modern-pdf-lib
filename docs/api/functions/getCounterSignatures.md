[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getCounterSignatures

# Function: getCounterSignatures()

> **getCounterSignatures**(`pdf`): [`CounterSignatureInfo`](../interfaces/CounterSignatureInfo.md)[]

Defined in: [src/signature/counterSignature.ts:490](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/counterSignature.ts#L490)

Extract counter-signatures from all signatures in a PDF.

Scans each signature's PKCS#7 structure for the counter-signature
unsigned attribute (OID 1.2.840.113549.1.9.6).

## Parameters

### pdf

`Uint8Array`

The PDF bytes.

## Returns

[`CounterSignatureInfo`](../interfaces/CounterSignatureInfo.md)[]

Array of counter-signature info objects.

## Example

```ts
const counterSigs = getCounterSignatures(pdfBytes);
for (const cs of counterSigs) {
  console.log(`Signature ${cs.targetSignatureIndex} counter-signed by ${cs.signerName}`);
}
```
