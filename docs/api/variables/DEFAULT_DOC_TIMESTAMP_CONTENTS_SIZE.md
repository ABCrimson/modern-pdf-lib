[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE

# Variable: DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE

```ts
const DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE: number = 8192;
```

Defined in: [src/signature/docTimeStamp.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/docTimeStamp.ts#L51)

Default size, in bytes, of the `/Contents` placeholder.

An RFC 3161 TimeStampToken (including the TSA certificate chain) is
typically a few kilobytes; 8192 bytes (16384 hex digits) leaves ample
room for most TSAs while keeping the placeholder modest.
