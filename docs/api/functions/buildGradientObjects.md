[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildGradientObjects

# Function: buildGradientObjects()

```ts
function buildGradientObjects(gradient, registry): object;
```

Defined in: [src/core/patterns.ts:375](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/patterns.ts#L375)

Materialise a [GradientFill](../interfaces/GradientFill.md) descriptor into actual PDF objects
in the given registry.

## Parameters

### gradient

[`GradientFill`](../interfaces/GradientFill.md)

The gradient descriptor.

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
