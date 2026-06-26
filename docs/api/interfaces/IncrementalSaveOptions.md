[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalSaveOptions

# Interface: IncrementalSaveOptions

Defined in: [src/signature/incrementalSave.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L41)

Options for incremental save with signature preservation.

## Properties

### compress?

```ts
optional compress?: boolean;
```

Defined in: [src/signature/incrementalSave.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L43)

Apply FlateDecode compression to new stream objects. Default: true.

***

### preserveSignatures?

```ts
optional preserveSignatures?: boolean;
```

Defined in: [src/signature/incrementalSave.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/incrementalSave.ts#L45)

Preserve existing signatures by verifying byte ranges. Default: true.
