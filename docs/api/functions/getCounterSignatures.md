[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getCounterSignatures

# Function: getCounterSignatures()

```ts
function getCounterSignatures(pdf): CounterSignatureInfo[];
```

Defined in: [src/signature/counterSignature.ts:422](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/counterSignature.ts#L422)

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
