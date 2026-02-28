[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TimestampResult

# Interface: TimestampResult

Defined in: [src/signature/timestamp.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/signature/timestamp.ts#L37)

Result from a timestamp request.

## Properties

### signingTime

> **signingTime**: `Date`

Defined in: [src/signature/timestamp.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/signature/timestamp.ts#L41)

The signing time reported by the TSA.

***

### timestampToken

> **timestampToken**: `Uint8Array`

Defined in: [src/signature/timestamp.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/signature/timestamp.ts#L39)

The DER-encoded TimeStampToken (a CMS SignedData).
