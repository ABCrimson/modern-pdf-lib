[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildOutputIntent

# Function: buildOutputIntent()

> **buildOutputIntent**(`registry`, `options?`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/compliance/outputIntent.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/compliance/outputIntent.ts#L119)

Build an OutputIntent dictionary and register it in the given registry.

This creates:
1. An ICC profile stream object (with `/N` set to the number of components)
2. An OutputIntent dictionary referencing that profile

Both objects are registered as indirect objects. The returned `PdfRef`
points to the OutputIntent dictionary, which should be added to the
catalog's `/OutputIntents` array.

## Parameters

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The PDF object registry to register objects into.

### options?

[`OutputIntentOptions`](../interfaces/OutputIntentOptions.md) = `{}`

Configuration for the output intent.

## Returns

[`PdfRef`](../classes/PdfRef.md)

An indirect reference to the OutputIntent dictionary.

## Example

```ts
import { PdfObjectRegistry } from 'modern-pdf-lib';
import { buildOutputIntent } from 'modern-pdf-lib';

const registry = new PdfObjectRegistry();
const intentRef = buildOutputIntent(registry);
// Add intentRef to catalog's /OutputIntents array
```
