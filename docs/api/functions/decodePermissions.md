[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodePermissions

# Function: decodePermissions()

> **decodePermissions**(`value`): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

Defined in: [src/crypto/permissions.ts:168](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/crypto/permissions.ts#L168)

Decode the 32-bit /P integer from a PDF encryption dictionary into
human-friendly permission flags.

## Parameters

### value

`number`

The /P integer from the encryption dictionary.

## Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

The decoded permission flags.
