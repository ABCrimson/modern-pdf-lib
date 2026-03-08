[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeObjectHash

# Function: computeObjectHash()

> **computeObjectHash**(`data`): `string`

Defined in: [src/signature/incrementalOptimizer.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalOptimizer.ts#L47)

FNV-1a 32-bit hash.

A fast, non-cryptographic hash with good distribution properties.
Used for content comparison and deduplication.

## Parameters

### data

`Uint8Array`

The bytes to hash.

## Returns

`string`

A 32-bit unsigned hash as a hex string.
