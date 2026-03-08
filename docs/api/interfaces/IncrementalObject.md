[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalObject

# Interface: IncrementalObject

Defined in: [src/signature/incrementalSave.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalSave.ts#L59)

An object to be appended in an incremental update.

## Properties

### data

> **data**: `Uint8Array`

Defined in: [src/signature/incrementalSave.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalSave.ts#L65)

The serialized object data (everything between `N G obj\n` and `\nendobj`).

***

### generationNumber

> **generationNumber**: `number`

Defined in: [src/signature/incrementalSave.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalSave.ts#L63)

The generation number (usually 0).

***

### objectNumber

> **objectNumber**: `number`

Defined in: [src/signature/incrementalSave.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalSave.ts#L61)

The PDF object number.
