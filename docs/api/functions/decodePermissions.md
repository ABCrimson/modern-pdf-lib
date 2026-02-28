[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodePermissions

# Function: decodePermissions()

> **decodePermissions**(`value`): [`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

Defined in: [src/crypto/permissions.ts:168](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/crypto/permissions.ts#L168)

Decode the 32-bit /P integer from a PDF encryption dictionary into
human-friendly permission flags.

## Parameters

### value

`number`

The /P integer from the encryption dictionary.

## Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

The decoded permission flags.
