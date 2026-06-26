[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockOptions

# Interface: FieldLockOptions

Defined in: [src/signature/fieldLock.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L30)

Options for locking fields when a signature is applied.

## Properties

### action

```ts
action: "All" | "Include" | "Exclude";
```

Defined in: [src/signature/fieldLock.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L32)

Lock action: 'All', 'Include', or 'Exclude'.

***

### fields?

```ts
optional fields?: string[];
```

Defined in: [src/signature/fieldLock.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L34)

Field names to include or exclude (required for 'Include' and 'Exclude').
