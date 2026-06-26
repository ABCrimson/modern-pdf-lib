[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildRequirement

# Function: buildRequirement()

> **buildRequirement**(`type`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/requirements.ts:69

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
