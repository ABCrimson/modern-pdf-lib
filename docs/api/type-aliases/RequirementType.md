[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RequirementType

# Type Alias: RequirementType

```ts
type RequirementType = 
  | "EnableJavaScripts"
  | "Attachment"
  | "AcroForm"
  | "Navigation"
  | "Markup"
  | "Encryption"
  | "DigSigValidation";
```

Defined in: [src/core/requirements.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/requirements.ts#L45)

A standard requirement type, used as the `/S` (subtype) value of a
requirement dictionary.  Each value names a feature the reader must
support to fully process the document.

| Value                 | Meaning                                            |
|-----------------------|----------------------------------------------------|
| `EnableJavaScripts`   | Document-level JavaScript must be executable.      |
| `Attachment`          | Embedded file attachments must be supported.       |
| `AcroForm`            | Interactive (AcroForm) form fields are present.    |
| `Navigation`          | Presentation / navigation nodes must be supported. |
| `Markup`              | Markup annotations must be supported.              |
| `Encryption`          | The encryption scheme must be supported.           |
| `DigSigValidation`    | Digital signatures must be validatable.            |
