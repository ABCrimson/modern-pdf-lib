[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / FieldLockInfo

# Interface: FieldLockInfo

Defined in: [src/signature/fieldLock.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/fieldLock.ts#L40)

Information about a field lock on a signature field.

## Properties

### action

```ts
action: "All" | "Include" | "Exclude";
```

Defined in: [src/signature/fieldLock.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/fieldLock.ts#L44)

The lock action: 'All', 'Include', or 'Exclude'.

***

### lockedFields

```ts
lockedFields: string[];
```

Defined in: [src/signature/fieldLock.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/fieldLock.ts#L46)

The list of locked fields (empty for 'All' action).

***

### signatureFieldName

```ts
signatureFieldName: string;
```

Defined in: [src/signature/fieldLock.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/fieldLock.ts#L42)

The name of the signature field that has the lock.
