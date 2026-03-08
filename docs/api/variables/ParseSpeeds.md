[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ParseSpeeds

# Variable: ParseSpeeds

> `const` **ParseSpeeds**: `object`

Defined in: [src/core/enums.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/enums.ts#L88)

Preset parsing speeds — maps to objectsPerTick values in LoadPdfOptions.

Lower values keep the main thread more responsive but parse more slowly.

## Type Declaration

### Fast

> `readonly` **Fast**: `500` = `500`

### Fastest

> `readonly` **Fastest**: `number` = `Infinity`

### Medium

> `readonly` **Medium**: `100` = `100`

### Slow

> `readonly` **Slow**: `10` = `10`
