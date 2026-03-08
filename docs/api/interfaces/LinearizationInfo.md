[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LinearizationInfo

# Interface: LinearizationInfo

Defined in: [src/core/linearization.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L48)

Information extracted from a linearization parameter dictionary.
Maps to the entries defined in PDF spec §F.2.

## Properties

### firstPageOffset

> **firstPageOffset**: `number`

Defined in: [src/core/linearization.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L58)

Byte offset of the end of the first page section (/E).

***

### length

> **length**: `number`

Defined in: [src/core/linearization.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L52)

File length (/L).

***

### pageCount

> **pageCount**: `number`

Defined in: [src/core/linearization.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L56)

Total page count (/N).

***

### primaryPage

> **primaryPage**: `number`

Defined in: [src/core/linearization.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L54)

Object number of the first page's page object (/O).

***

### version

> **version**: `number`

Defined in: [src/core/linearization.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/linearization.ts#L50)

Linearization version (e.g. 1.0).
