[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildRequirement

# Function: buildRequirement()

```ts
function buildRequirement(type): PdfDict;
```

Defined in: [src/core/requirements.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/requirements.ts#L69)

Build a single requirement dictionary for the given requirement type.

The returned dictionary has the form:
```
<< /Type /Reqs /S /<type> >>
```

## Parameters

### type

[`RequirementType`](../type-aliases/RequirementType.md)

The requirement type used as the `/S` name.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A [PdfDict](../classes/PdfDict.md) representing one requirement dictionary.
