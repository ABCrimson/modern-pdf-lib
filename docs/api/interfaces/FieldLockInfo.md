[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockInfo

# Interface: FieldLockInfo

Defined in: [src/signature/fieldLock.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L40)

Information about a field lock on a signature field.

## Properties

### action

> **action**: `"All"` \| `"Include"` \| `"Exclude"`

Defined in: [src/signature/fieldLock.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L44)

The lock action: 'All', 'Include', or 'Exclude'.

***

### lockedFields

> **lockedFields**: `string`[]

Defined in: [src/signature/fieldLock.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L46)

The list of locked fields (empty for 'All' action).

***

### signatureFieldName

> **signatureFieldName**: `string`

Defined in: [src/signature/fieldLock.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L42)

The name of the signature field that has the lock.
