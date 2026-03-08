[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureChainResult

# Interface: SignatureChainResult

Defined in: [src/signature/multiSignatureValidator.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/multiSignatureValidator.ts#L47)

Result of validating the entire signature chain.

## Properties

### errors

> **errors**: `string`[]

Defined in: [src/signature/multiSignatureValidator.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/multiSignatureValidator.ts#L53)

Descriptive error messages, if any.

***

### isChainValid

> **isChainValid**: `boolean`

Defined in: [src/signature/multiSignatureValidator.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/multiSignatureValidator.ts#L51)

Whether the entire chain is valid (all entries valid, no breaks).

***

### signatures

> **signatures**: [`SignatureChainEntry`](SignatureChainEntry.md)[]

Defined in: [src/signature/multiSignatureValidator.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/multiSignatureValidator.ts#L49)

Ordered array of signature chain entries.
