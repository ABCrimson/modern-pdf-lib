[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockOptions

# Interface: FieldLockOptions

Defined in: [src/signature/fieldLock.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L30)

Options for locking fields when a signature is applied.

## Properties

### action

> **action**: `"All"` \| `"Include"` \| `"Exclude"`

Defined in: [src/signature/fieldLock.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L32)

Lock action: 'All', 'Include', or 'Exclude'.

***

### fields?

> `optional` **fields**: `string`[]

Defined in: [src/signature/fieldLock.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/fieldLock.ts#L34)

Field names to include or exclude (required for 'Include' and 'Exclude').
