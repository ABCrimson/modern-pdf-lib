[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDPartRoot

# Function: buildDPartRoot()

> **buildDPartRoot**(`parts`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/documentParts.ts:106

Build a PDF 2.0 `/DPartRoot` dictionary from a flat list of document parts.

The returned dictionary has:
 - `/Type /DPartRoot`
 - `/DPartRootNode` → a top `/DPart` node whose `/DParts` array holds one
   child `/DPart` node per supplied [DocumentPart](../interfaces/DocumentPart.md).

Each child node records its `/Start` and `/End` page indices and, when
present, its `/DPM` metadata dictionary.  The structure is self-contained:
page positions are stored as plain numbers rather than resolved page
references.

## Parameters

### parts

readonly [`DocumentPart`](../interfaces/DocumentPart.md)[]

The document parts, in page order.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A spec-shaped `/DPartRoot` [PdfDict](../classes/PdfDict.md).
