[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeObjectHash

# Function: computeObjectHash()

> **computeObjectHash**(`data`): `string`

Defined in: [src/signature/incrementalOptimizer.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/incrementalOptimizer.ts#L47)

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
