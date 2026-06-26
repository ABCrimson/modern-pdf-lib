[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildVtDpm

# Function: buildVtDpm()

```ts
function buildVtDpm(record): PdfDict;
```

Defined in: [src/compliance/pdfVT.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L80)

Build the VT *Document Part Metadata* (`/DPM`) dictionary for a single record.

The dictionary carries:
 - `/Type /DPM`
 - `/S /VT` — selects the VT (variable / transactional) metadata namespace
 - `/RecordID` — the record's stable identifier (literal string)
 - one literal-string entry per [RecordMetadata.fields](../interfaces/VtRecordMetadata.md#fields) pair

## Parameters

### record

[`VtRecordMetadata`](../interfaces/VtRecordMetadata.md)

The record whose metadata to encode.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A spec-shaped VT `/DPM` [PdfDict](../classes/PdfDict.md).
