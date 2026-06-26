[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockOptions

# Interface: FieldLockOptions

Defined in: [src/signature/fieldLock.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/fieldLock.ts#L30)

Options for locking fields when a signature is applied.

## Properties

### action

> **action**: `"All"` \| `"Include"` \| `"Exclude"`

Defined in: [src/signature/fieldLock.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/fieldLock.ts#L32)

Lock action: 'All', 'Include', or 'Exclude'.

***

### fields?

> `optional` **fields?**: `string`[]

Defined in: [src/signature/fieldLock.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/fieldLock.ts#L34)

Field names to include or exclude (required for 'Include' and 'Exclude').
