[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDocTimeStampDict

# Function: buildDocTimeStampDict()

> **buildDocTimeStampDict**(`options?`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/signature/docTimeStamp.ts:107

Build a standalone Document Timestamp signature dictionary.

The returned [PdfDict](../classes/PdfDict.md) contains:
- `/Type`      `/DocTimeStamp`
- `/Filter`    `/Adobe.PPKLite`
- `/SubFilter` `/ETSI.RFC3161`
- `/ByteRange` `[0 0 0 0]` — a placeholder to be patched during save
- `/Contents`  a zero-filled hex string of `contentsSize` bytes
- `/Reason`    (only when [DocTimeStampOptions.reason](../interfaces/DocTimeStampOptions.md#reason) is given)

The `/Contents` value is serialized as a hexadecimal string
(`<0000…>`); it occupies `contentsSize` bytes ⇒ `2 × contentsSize`
hex digits.  The real RFC 3161 TimeStampToken is injected over this
placeholder later, during incremental save.

## Parameters

### options?

[`DocTimeStampOptions`](../interfaces/DocTimeStampOptions.md)

Optional configuration.

## Returns

[`PdfDict`](../classes/PdfDict.md)

The Document Timestamp signature dictionary.

## Throws

when `contentsSize` is not a positive
                integer.

## Example

```ts
const dts = buildDocTimeStampDict({ contentsSize: 16384 });
const ref = registry.register(dts);
// …later, during incremental save, patch /ByteRange and /Contents
// with the offsets and the TSA token from requestTimestamp().
```
