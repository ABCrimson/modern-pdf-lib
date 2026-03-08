[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TransparencyInfo

# Interface: TransparencyInfo

Defined in: [src/compliance/transparencyFlattener.ts:19](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L19)

Detected transparency usage in a PDF.

## Properties

### blendModeCount

> `readonly` **blendModeCount**: `number`

Defined in: [src/compliance/transparencyFlattener.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L29)

Number of non-Normal blend mode references.

***

### fillOpacityCount

> `readonly` **fillOpacityCount**: `number`

Defined in: [src/compliance/transparencyFlattener.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L25)

Number of ExtGState objects with non-1.0 ca.

***

### findings

> `readonly` **findings**: [`TransparencyFinding`](TransparencyFinding.md)[]

Defined in: [src/compliance/transparencyFlattener.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L31)

Detailed findings.

***

### hasTransparency

> `readonly` **hasTransparency**: `boolean`

Defined in: [src/compliance/transparencyFlattener.ts:21](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L21)

Whether any transparency was found.

***

### softMaskCount

> `readonly` **softMaskCount**: `number`

Defined in: [src/compliance/transparencyFlattener.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L27)

Number of SMask references found.

***

### strokeOpacityCount

> `readonly` **strokeOpacityCount**: `number`

Defined in: [src/compliance/transparencyFlattener.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/transparencyFlattener.ts#L23)

Number of ExtGState objects with non-1.0 CA.
