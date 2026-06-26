[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / VtRecordMetadata

# Interface: VtRecordMetadata

Defined in: src/compliance/pdfVT.ts:50

Metadata describing a single variable-data *record*.

A record spans a contiguous, inclusive range of zero-based page indices and
carries a stable identifier plus optional production fields.

## Properties

### endPage

> `readonly` **endPage**: `number`

Defined in: src/compliance/pdfVT.ts:54

Zero-based index of the last page in this record (inclusive).

***

### fields?

> `readonly` `optional` **fields?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: src/compliance/pdfVT.ts:61

Optional per-record production fields.  Each key/value pair is emitted as
a PDF name → literal-string entry inside the record's `/DPM` dictionary.

***

### recordId

> `readonly` **recordId**: `string`

Defined in: src/compliance/pdfVT.ts:56

Stable record identifier (emitted as `/RecordID`).

***

### startPage

> `readonly` **startPage**: `number`

Defined in: src/compliance/pdfVT.ts:52

Zero-based index of the first page in this record (inclusive).
