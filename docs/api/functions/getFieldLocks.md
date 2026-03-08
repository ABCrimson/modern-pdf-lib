[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getFieldLocks

# Function: getFieldLocks()

> **getFieldLocks**(`pdf`): [`FieldLockInfo`](../interfaces/FieldLockInfo.md)[]

Defined in: [src/signature/fieldLock.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L115)

Read all field lock dictionaries from signature fields in a PDF.

Scans the PDF for signature field dictionaries that contain a /Lock
entry and extracts the lock action and field names.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`FieldLockInfo`](../interfaces/FieldLockInfo.md)[]

Array of field lock information objects.
