[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AccessibilityIssue

# Interface: AccessibilityIssue

Defined in: [src/accessibility/structureTree.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/structureTree.ts#L124)

Describes a single accessibility issue found during validation.

## Properties

### code

```ts
code: string;
```

Defined in: [src/accessibility/structureTree.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/structureTree.ts#L128)

Machine-readable issue code.

***

### element?

```ts
optional element?: PdfStructureElement;
```

Defined in: [src/accessibility/structureTree.ts:132](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/structureTree.ts#L132)

The structure element related to the issue, if any.

***

### message

```ts
message: string;
```

Defined in: [src/accessibility/structureTree.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/structureTree.ts#L130)

Human-readable description of the issue.

***

### pageIndex?

```ts
optional pageIndex?: number;
```

Defined in: [src/accessibility/structureTree.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/structureTree.ts#L134)

The zero-based page index related to the issue, if any.

***

### severity

```ts
severity: "error" | "warning" | "info";
```

Defined in: [src/accessibility/structureTree.ts:126](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/accessibility/structureTree.ts#L126)

Severity of the issue.
