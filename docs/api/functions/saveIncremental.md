[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / saveIncremental

# Function: saveIncremental()

```ts
function saveIncremental(
   originalBytes, 
   registry, 
   structure, 
   changedObjects, 
   options?): IncrementalSaveResult;
```

Defined in: [src/core/incrementalWriter.ts:241](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/incrementalWriter.ts#L241)

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

`Set`\&lt;`number`\&gt;

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
