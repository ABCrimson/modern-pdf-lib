[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TimestampResult

# Interface: TimestampResult

Defined in: [src/signature/timestamp.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/timestamp.ts#L35)

Result from a timestamp request.

## Properties

### signingTime

```ts
signingTime: Date;
```

Defined in: [src/signature/timestamp.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/timestamp.ts#L39)

The signing time reported by the TSA.

***

### timestampToken

```ts
timestampToken: Uint8Array;
```

Defined in: [src/signature/timestamp.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/timestamp.ts#L37)

The DER-encoded TimeStampToken (a CMS SignedData).
