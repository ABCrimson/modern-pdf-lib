[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeContextTag

# Function: encodeContextTag()

> **encodeContextTag**(`tag`, `contents`): `Uint8Array`

Defined in: [src/signature/pkcs7.ts:327](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/signature/pkcs7.ts#L327)

Encode a context-specific tagged value (implicit or explicit).

For PKCS#7:
- [0] is used for content in ContentInfo (explicit, constructed)
- [0] IMPLICIT is used for certificates in SignedData
- [0] IMPLICIT is used for signed attributes in SignerInfo

## Parameters

### tag

`number`

### contents

`Uint8Array`

## Returns

`Uint8Array`
