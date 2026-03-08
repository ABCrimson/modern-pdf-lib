[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildTimestampRequest

# Function: buildTimestampRequest()

> **buildTimestampRequest**(`dataHash`, `hashAlgorithm`): `Uint8Array`

Defined in: [src/signature/timestamp.ts:141](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/timestamp.ts#L141)

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
