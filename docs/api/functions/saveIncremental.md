[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveIncremental

# Function: saveIncremental()

> **saveIncremental**(`originalBytes`, `registry`, `structure`, `changedObjects`, `options?`): [`IncrementalSaveResult`](../interfaces/IncrementalSaveResult.md)

Defined in: [src/core/incrementalWriter.ts:245](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/incrementalWriter.ts#L245)

Perform an incremental save of a PDF document.

Takes the original file bytes and a registry of objects (some new,
some modified), and appends only the changed objects plus a new xref
section and trailer.

The resulting bytes form a valid PDF file that preserves the original
content byte-for-byte and appends the modifications.

## Parameters

### originalBytes

`Uint8Array`

The original PDF file bytes (unmodified).

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The object registry containing all objects
                      (original + new/modified).

### structure

[`DocumentStructure`](../interfaces/DocumentStructure.md)

Document structure references (catalog, info, pages).

### changedObjects

`Set`\<`number`\>

Set of object numbers that are new or modified.

### options?

[`PdfSaveOptions`](../interfaces/PdfSaveOptions.md)

Optional save options (compression, etc.).

## Returns

[`IncrementalSaveResult`](../interfaces/IncrementalSaveResult.md)

The complete incremental save result.

## Example

```ts
const result = saveIncremental(originalBytes, registry, structure, changedObjects);
await writeFile('output.pdf', result.bytes);
```
