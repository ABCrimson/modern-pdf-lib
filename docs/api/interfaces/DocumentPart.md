[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocumentPart

# Interface: DocumentPart

Defined in: src/core/documentParts.ts:39

A single document part: a contiguous, inclusive range of page indices plus
optional Document Part Metadata.

## Properties

### endPage

> `readonly` **endPage**: `number`

Defined in: src/core/documentParts.ts:43

Zero-based index of the last page in this part (inclusive).

***

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `string`\>\>

Defined in: src/core/documentParts.ts:48

Optional Document Part Metadata.  Each key/value pair is emitted as a
PDF name → literal-string entry inside the part's `/DPM` dictionary.

***

### startPage

> `readonly` **startPage**: `number`

Defined in: src/core/documentParts.ts:41

Zero-based index of the first page in this part (inclusive).
