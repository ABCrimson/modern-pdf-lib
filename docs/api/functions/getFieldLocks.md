[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getFieldLocks

# Function: getFieldLocks()

```ts
function getFieldLocks(pdf): FieldLockInfo[];
```

Defined in: [src/signature/fieldLock.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/fieldLock.ts#L115)

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
