[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CalGrayParams

# Interface: CalGrayParams

Defined in: src/core/colorSpacesCIE.ts:30

Parameters for a CalGray colour space (ISO 32000-2 §8.6.5.2).

## Properties

### blackPoint?

> `readonly` `optional` **blackPoint?**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:34

Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`.

***

### gamma?

> `readonly` `optional` **gamma?**: `number`

Defined in: src/core/colorSpacesCIE.ts:36

Gamma exponent for the single grey component; defaults to 1.0.

***

### whitePoint

> `readonly` **whitePoint**: readonly \[`number`, `number`, `number`\]

Defined in: src/core/colorSpacesCIE.ts:32

Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0.
