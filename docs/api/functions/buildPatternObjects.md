[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPatternObjects

# Function: buildPatternObjects()

```ts
function buildPatternObjects(pattern, registry): object;
```

Defined in: [src/core/patterns.ts:418](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L418)

Materialise a [PatternFill](../interfaces/PatternFill.md) descriptor into actual PDF objects
in the given registry.

## Parameters

### pattern

[`PatternFill`](../interfaces/PatternFill.md)

The tiling pattern descriptor.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The document's object registry.

## Returns

`object`

An object with the pattern's indirect reference and a unique
         resource name.

### patternName

```ts
patternName: string;
```

### patternRef

```ts
patternRef: PdfRef;
```
