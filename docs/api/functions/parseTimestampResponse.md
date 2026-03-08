[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseTimestampResponse

# Function: parseTimestampResponse()

> **parseTimestampResponse**(`response`): [`TimestampResult`](../interfaces/TimestampResult.md)

Defined in: [src/signature/timestamp.ts:200](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/signature/timestamp.ts#L200)

Parse a DER-encoded TimeStampResp (RFC 3161 SS2.4.2).

```
TimeStampResp ::= SEQUENCE {
  status          PKIStatusInfo,
  timeStampToken  ContentInfo OPTIONAL
}

PKIStatusInfo ::= SEQUENCE {
  status        PKIStatus (INTEGER),
  statusString  PKIFreeText OPTIONAL,
  failInfo      PKIFailureInfo OPTIONAL
}
```

## Parameters

### response

`Uint8Array`

DER-encoded TimeStampResp.

## Returns

[`TimestampResult`](../interfaces/TimestampResult.md)

The parsed timestamp result.

## Throws

Error if the TSA reported an error status.
