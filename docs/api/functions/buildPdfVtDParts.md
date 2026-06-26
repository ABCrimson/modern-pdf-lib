[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPdfVtDParts

# Function: buildPdfVtDParts()

```ts
function buildPdfVtDParts(records): PdfDict;
```

Defined in: [src/compliance/pdfVT.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L112)

Build a PDF/VT `/DPartRoot` dictionary from a flat list of records.

Each record becomes one child `/DPart` node (via [buildDPartRoot](buildDPartRoot.md)),
and that child is augmented with a VT `/DPM` dictionary produced by
[buildVtDpm](buildVtDpm.md).  The returned structure mirrors [buildDPartRoot](buildDPartRoot.md):
 - `/Type /DPartRoot`
 - `/DPartRootNode` → a top `/DPart` node whose `/DParts` array holds one
   child `/DPart` per record, each carrying `/Start`, `/End`, and a VT `/DPM`.

The structure is self-contained: page positions are stored as plain numbers
rather than resolved page references.

## Parameters

### records

readonly [`VtRecordMetadata`](../interfaces/VtRecordMetadata.md)[]

The variable-data records, in page order.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A spec-shaped PDF/VT `/DPartRoot` [PdfDict](../classes/PdfDict.md).
