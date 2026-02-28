[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodePermissions

# Function: encodePermissions()

> **encodePermissions**(`flags`): `number`

Defined in: [src/crypto/permissions.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/permissions.ts#L102)

Encode human-friendly permission flags into the 32-bit /P integer
used in the PDF encryption dictionary.

By default (when all flags are `undefined` or `false`), no
permissions are granted beyond the reserved bits.

## Parameters

### flags

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

The permissions to encode.

## Returns

`number`

A 32-bit signed integer for the /P entry.
