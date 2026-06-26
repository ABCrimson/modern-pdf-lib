[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LabParams

# Interface: LabParams

Defined in: src/core/colorSpacesCIE.ts:52

Parameters for a Lab colour space (ISO 32000-2 §8.6.5.4).

## Properties

### blackPoint?

> `readonly` `optional` **blackPoint?**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:56

Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`.

***

### range?

> `readonly` `optional` **range?**: readonly \[`number`, `number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:58

`[amin amax bmin bmax]` ranges for the a* and b* components.

***

### whitePoint

> `readonly` **whitePoint**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:54

Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0.
