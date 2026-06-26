[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocTimeStampOptions

# Interface: DocTimeStampOptions

Defined in: src/signature/docTimeStamp.ts:60

Options controlling how the Document Timestamp dictionary is built.

## Properties

### contentsSize?

> `readonly` `optional` **contentsSize?**: `number`

Defined in: src/signature/docTimeStamp.ts:66

Number of bytes reserved for the `/Contents` placeholder.  This must
be large enough to hold the DER-encoded TimeStampToken returned by
the TSA.  Defaults to [DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE](../variables/DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE.md).

***

### reason?

> `readonly` `optional` **reason?**: `string`

Defined in: src/signature/docTimeStamp.ts:71

Optional human-readable reason recorded in the signature dictionary's
`/Reason` field.  Purely informational for a timestamp.
