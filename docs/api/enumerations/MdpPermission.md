[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / MdpPermission

# Enumeration: MdpPermission

Defined in: [src/signature/mdpPolicy.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/mdpPolicy.ts#L33)

MDP permission levels for certification signatures.

These correspond to the /P value in the /TransformParams dictionary
of a /DocMDP transform method.

## Enumeration Members

### FormFillAndSign

```ts
FormFillAndSign: 2;
```

Defined in: [src/signature/mdpPolicy.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/mdpPolicy.ts#L37)

Only form filling and signing are permitted.

***

### FormFillSignAnnotate

```ts
FormFillSignAnnotate: 3;
```

Defined in: [src/signature/mdpPolicy.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/mdpPolicy.ts#L39)

Form filling, signing, and annotation changes are permitted.

***

### NoChanges

```ts
NoChanges: 1;
```

Defined in: [src/signature/mdpPolicy.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/mdpPolicy.ts#L35)

No changes to the document are permitted.
