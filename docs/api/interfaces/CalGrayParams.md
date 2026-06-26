[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CalGrayParams

# Interface: CalGrayParams

Defined in: [src/core/colorSpacesCIE.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L30)

Parameters for a CalGray colour space (ISO 32000-2 §8.6.5.2).

## Properties

### blackPoint?

```ts
readonly optional blackPoint?: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L34)

Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`.

***

### gamma?

```ts
readonly optional gamma?: number;
```

Defined in: [src/core/colorSpacesCIE.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L36)

Gamma exponent for the single grey component; defaults to 1.0.

***

### whitePoint

```ts
readonly whitePoint: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L32)

Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0.
