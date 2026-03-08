[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MdpPermission

# Enumeration: MdpPermission

Defined in: [src/signature/mdpPolicy.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/mdpPolicy.ts#L33)

MDP permission levels for certification signatures.

These correspond to the /P value in the /TransformParams dictionary
of a /DocMDP transform method.

## Enumeration Members

### FormFillAndSign

> **FormFillAndSign**: `2`

Defined in: [src/signature/mdpPolicy.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/mdpPolicy.ts#L37)

Only form filling and signing are permitted.

***

### FormFillSignAnnotate

> **FormFillSignAnnotate**: `3`

Defined in: [src/signature/mdpPolicy.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/mdpPolicy.ts#L39)

Form filling, signing, and annotation changes are permitted.

***

### NoChanges

> **NoChanges**: `1`

Defined in: [src/signature/mdpPolicy.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/mdpPolicy.ts#L35)

No changes to the document are permitted.
