[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addFieldLock

# Function: addFieldLock()

> **addFieldLock**(`options`, `lock`): `void`

Defined in: [src/signature/fieldLock.ts:92](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/fieldLock.ts#L92)

Add a field lock dictionary to sign options.

When applied, the resulting signature field will include a /Lock
dictionary that specifies which form fields should be locked after
this signature is applied.

## Parameters

### options

[`SignOptions`](../interfaces/SignOptions.md)

The sign options to modify (mutated in place).

### lock

[`FieldLockOptions`](../interfaces/FieldLockOptions.md)

The field lock configuration.

## Returns

`void`

## Example

```ts
const options: SignOptions = {
  certificate: certDer,
  privateKey: keyDer,
};
addFieldLock(options, {
  action: 'Include',
  fields: ['Name', 'Address', 'Amount'],
});
const signedPdf = await signPdf(pdfBytes, 'ApprovalSig', options);
```
