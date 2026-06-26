[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildTimestampRequest

# Function: buildTimestampRequest()

```ts
function buildTimestampRequest(dataHash, hashAlgorithm): Uint8Array;
```

Defined in: [src/signature/timestamp.ts:139](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/timestamp.ts#L139)

Build a DER-encoded TimeStampReq (RFC 3161 SS2.4.1).

```
TimeStampReq ::= SEQUENCE {
  version         INTEGER { v1(1) },
  messageImprint  MessageImprint,
  reqPolicy       TSAPolicyId OPTIONAL,
  nonce           INTEGER OPTIONAL,
  certReq         BOOLEAN DEFAULT FALSE,
  extensions      [0] IMPLICIT Extensions OPTIONAL
}

MessageImprint ::= SEQUENCE {
  hashAlgorithm   AlgorithmIdentifier,
  hashedMessage    OCTET STRING
}
```

## Parameters

### dataHash

`Uint8Array`

The hash of the data to timestamp.

### hashAlgorithm

`string`

The hash algorithm used.

## Returns

`Uint8Array`

DER-encoded TimeStampReq.
