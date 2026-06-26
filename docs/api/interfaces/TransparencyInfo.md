[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyInfo

# Interface: TransparencyInfo

Defined in: [src/compliance/transparencyFlattener.ts:19](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L19)

Detected transparency usage in a PDF.

## Properties

### blendModeCount

```ts
readonly blendModeCount: number;
```

Defined in: [src/compliance/transparencyFlattener.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L29)

Number of non-Normal blend mode references.

***

### fillOpacityCount

```ts
readonly fillOpacityCount: number;
```

Defined in: [src/compliance/transparencyFlattener.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L25)

Number of ExtGState objects with non-1.0 ca.

***

### findings

```ts
readonly findings: TransparencyFinding[];
```

Defined in: [src/compliance/transparencyFlattener.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L31)

Detailed findings.

***

### hasTransparency

```ts
readonly hasTransparency: boolean;
```

Defined in: [src/compliance/transparencyFlattener.ts:21](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L21)

Whether any transparency was found.

***

### softMaskCount

```ts
readonly softMaskCount: number;
```

Defined in: [src/compliance/transparencyFlattener.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L27)

Number of SMask references found.

***

### strokeOpacityCount

```ts
readonly strokeOpacityCount: number;
```

Defined in: [src/compliance/transparencyFlattener.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/transparencyFlattener.ts#L23)

Number of ExtGState objects with non-1.0 CA.
