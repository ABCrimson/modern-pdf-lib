[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / VtRecordMetadata

# Interface: VtRecordMetadata

Defined in: [src/compliance/pdfVT.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L50)

Metadata describing a single variable-data *record*.

A record spans a contiguous, inclusive range of zero-based page indices and
carries a stable identifier plus optional production fields.

## Properties

### endPage

```ts
readonly endPage: number;
```

Defined in: [src/compliance/pdfVT.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L54)

Zero-based index of the last page in this record (inclusive).

***

### fields?

```ts
readonly optional fields?: Readonly<Record<string, string>>;
```

Defined in: [src/compliance/pdfVT.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L61)

Optional per-record production fields.  Each key/value pair is emitted as
a PDF name → literal-string entry inside the record's `/DPM` dictionary.

***

### recordId

```ts
readonly recordId: string;
```

Defined in: [src/compliance/pdfVT.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L56)

Stable record identifier (emitted as `/RecordID`).

***

### startPage

```ts
readonly startPage: number;
```

Defined in: [src/compliance/pdfVT.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfVT.ts#L52)

Zero-based index of the first page in this record (inclusive).
