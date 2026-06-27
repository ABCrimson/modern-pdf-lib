[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / NamespaceDef

# Interface: NamespaceDef

Defined in: [src/accessibility/namespaces.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/namespaces.ts#L57)

A plain, serializable description of a single PDF 2.0 structure
namespace.

## Properties

### ns

```ts
readonly ns: string;
```

Defined in: [src/accessibility/namespaces.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/namespaces.ts#L59)

The namespace identifier (`/NS`) — typically a URI.

***

### roleMap?

```ts
readonly optional roleMap?: Readonly<Record<string, string>>;
```

Defined in: [src/accessibility/namespaces.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/namespaces.ts#L69)

Optional role map (`/RoleMapNS`).  Maps namespace-specific structure
type names onto standard (or other-namespace) structure type names.

***

### schema?

```ts
readonly optional schema?: string;
```

Defined in: [src/accessibility/namespaces.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/namespaces.ts#L64)

Optional schema locator (`/Schema`).  Serialized as a PDF string;
usually a URI or file name pointing at the namespace's schema.
