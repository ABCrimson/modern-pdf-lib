[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocTimeStampOptions

# Interface: DocTimeStampOptions

Defined in: [src/signature/docTimeStamp.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/docTimeStamp.ts#L60)

Options controlling how the Document Timestamp dictionary is built.

## Properties

### contentsSize?

```ts
readonly optional contentsSize?: number;
```

Defined in: [src/signature/docTimeStamp.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/docTimeStamp.ts#L66)

Number of bytes reserved for the `/Contents` placeholder.  This must
be large enough to hold the DER-encoded TimeStampToken returned by
the TSA.  Defaults to [DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE](../variables/DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE.md).

***

### reason?

```ts
readonly optional reason?: string;
```

Defined in: [src/signature/docTimeStamp.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/docTimeStamp.ts#L71)

Optional human-readable reason recorded in the signature dictionary's
`/Reason` field.  Purely informational for a timestamp.
