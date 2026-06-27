[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildNamespace

# Function: buildNamespace()

```ts
function buildNamespace(def): PdfDict;
```

Defined in: [src/accessibility/namespaces.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/namespaces.ts#L85)

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
