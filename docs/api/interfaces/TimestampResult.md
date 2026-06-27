[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TimestampResult

# Interface: TimestampResult

Defined in: [src/signature/timestamp.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/timestamp.ts#L35)

Result from a timestamp request.

## Properties

### signingTime

```ts
signingTime: Date;
```

Defined in: [src/signature/timestamp.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/timestamp.ts#L39)

The signing time reported by the TSA.

***

### timestampToken

```ts
timestampToken: Uint8Array;
```

Defined in: [src/signature/timestamp.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/timestamp.ts#L37)

The DER-encoded TimeStampToken (a CMS SignedData).
