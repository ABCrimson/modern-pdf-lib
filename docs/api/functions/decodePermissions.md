[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodePermissions

# Function: decodePermissions()

> **decodePermissions**(`value`): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

Defined in: [src/crypto/permissions.ts:168](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/crypto/permissions.ts#L168)

Decode the 32-bit /P integer from a PDF encryption dictionary into
human-friendly permission flags.

## Parameters

### value

`number`

The /P integer from the encryption dictionary.

## Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

The decoded permission flags.
