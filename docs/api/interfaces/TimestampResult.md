[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TimestampResult

# Interface: TimestampResult

Defined in: [src/signature/timestamp.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/timestamp.ts#L35)

Result from a timestamp request.

## Properties

### signingTime

> **signingTime**: `Date`

Defined in: [src/signature/timestamp.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/timestamp.ts#L39)

The signing time reported by the TSA.

***

### timestampToken

> **timestampToken**: `Uint8Array`

Defined in: [src/signature/timestamp.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/timestamp.ts#L37)

The DER-encoded TimeStampToken (a CMS SignedData).
