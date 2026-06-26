[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildNamespace

# Function: buildNamespace()

> **buildNamespace**(`def`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/accessibility/namespaces.ts:85

Build a `/Namespace` dictionary from a [NamespaceDef](../interfaces/NamespaceDef.md).

The result always carries `/Type /Namespace` and `/NS` (a PDF string).
`/Schema` and `/RoleMapNS` are added only when supplied.

## Parameters

### def

[`NamespaceDef`](../interfaces/NamespaceDef.md)

the namespace descriptor.

## Returns

[`PdfDict`](../classes/PdfDict.md)

a freshly allocated [PdfDict](../classes/PdfDict.md) for the namespace.
