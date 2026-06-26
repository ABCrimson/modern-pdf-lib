[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildRequirements

# Function: buildRequirements()

> **buildRequirements**(`types`): [`PdfArray`](../classes/PdfArray.md)

Defined in: src/core/requirements.ts:88

Build the document catalog `/Requirements` array from a list of
requirement types.

Each element of the returned array is a requirement dictionary
(see [buildRequirement](buildRequirement.md)).  Duplicate types are preserved in the
order supplied; callers that want a de-duplicated set should filter the
input first.

## Parameters

### types

readonly [`RequirementType`](../type-aliases/RequirementType.md)[]

The requirement types, in the desired order.

## Returns

[`PdfArray`](../classes/PdfArray.md)

A [PdfArray](../classes/PdfArray.md) suitable for the catalog `/Requirements` key.
