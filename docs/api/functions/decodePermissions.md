[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodePermissions

# Function: decodePermissions()

```ts
function decodePermissions(value): PdfPermissionFlags;
```

Defined in: [src/crypto/permissions.ts:168](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/crypto/permissions.ts#L168)

Decode the 32-bit /P integer from a PDF encryption dictionary into
human-friendly permission flags.

## Parameters

### value

`number`

The /P integer from the encryption dictionary.

## Returns

[`PdfPermissionFlags`](../interfaces/PdfPermissionFlags.md)

The decoded permission flags.
