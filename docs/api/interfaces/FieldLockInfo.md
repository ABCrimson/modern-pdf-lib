[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockInfo

# Interface: FieldLockInfo

Defined in: [src/signature/fieldLock.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/fieldLock.ts#L40)

Information about a field lock on a signature field.

## Properties

### action

> **action**: `"All"` \| `"Include"` \| `"Exclude"`

Defined in: [src/signature/fieldLock.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/fieldLock.ts#L44)

The lock action: 'All', 'Include', or 'Exclude'.

***

### lockedFields

> **lockedFields**: `string`[]

Defined in: [src/signature/fieldLock.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/fieldLock.ts#L46)

The list of locked fields (empty for 'All' action).

***

### signatureFieldName

> **signatureFieldName**: `string`

Defined in: [src/signature/fieldLock.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/fieldLock.ts#L42)

The name of the signature field that has the lock.
