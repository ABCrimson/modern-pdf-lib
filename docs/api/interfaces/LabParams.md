[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LabParams

# Interface: LabParams

Defined in: [src/core/colorSpacesCIE.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L52)

Parameters for a Lab colour space (ISO 32000-2 §8.6.5.4).

## Properties

### blackPoint?

```ts
readonly optional blackPoint?: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L56)

Diffuse black point `[Xb Yb Zb]`; defaults to `[0 0 0]`.

***

### range?

```ts
readonly optional range?: readonly [number, number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L58)

`[amin amax bmin bmax]` ranges for the a* and b* components.

***

### whitePoint

```ts
readonly whitePoint: readonly [number, number, number];
```

Defined in: [src/core/colorSpacesCIE.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/colorSpacesCIE.ts#L54)

Diffuse white point `[Xw Yw Zw]`; `Yw` shall equal 1.0.
