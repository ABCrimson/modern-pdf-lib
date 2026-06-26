[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / NamespaceDef

# Interface: NamespaceDef

Defined in: src/accessibility/namespaces.ts:57

A plain, serializable description of a single PDF 2.0 structure
namespace.

## Properties

### ns

> `readonly` **ns**: `string`

Defined in: src/accessibility/namespaces.ts:59

The namespace identifier (`/NS`) — typically a URI.

***

### roleMap?

> `readonly` `optional` **roleMap?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: src/accessibility/namespaces.ts:69

Optional role map (`/RoleMapNS`).  Maps namespace-specific structure
type names onto standard (or other-namespace) structure type names.

***

### schema?

> `readonly` `optional` **schema?**: `string`

Defined in: src/accessibility/namespaces.ts:64

Optional schema locator (`/Schema`).  Serialized as a PDF string;
usually a URI or file name pointing at the namespace's schema.
