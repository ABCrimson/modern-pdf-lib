[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockInfo

# Interface: FieldLockInfo

Defined in: [src/signature/fieldLock.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L40)

Information about a field lock on a signature field.

## Properties

### action

```ts
action: "All" | "Include" | "Exclude";
```

Defined in: [src/signature/fieldLock.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L44)

The lock action: 'All', 'Include', or 'Exclude'.

***

### lockedFields

```ts
lockedFields: string[];
```

Defined in: [src/signature/fieldLock.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L46)

The list of locked fields (empty for 'All' action).

***

### signatureFieldName

```ts
signatureFieldName: string;
```

Defined in: [src/signature/fieldLock.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/fieldLock.ts#L42)

The name of the signature field that has the lock.
