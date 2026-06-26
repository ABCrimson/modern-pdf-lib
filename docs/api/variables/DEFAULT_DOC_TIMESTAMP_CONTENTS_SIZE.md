[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE

# Variable: DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE

> `const` **DEFAULT\_DOC\_TIMESTAMP\_CONTENTS\_SIZE**: `number` = `8192`

Defined in: src/signature/docTimeStamp.ts:51

Default size, in bytes, of the `/Contents` placeholder.

An RFC 3161 TimeStampToken (including the TSA certificate chain) is
typically a few kilobytes; 8192 bytes (16384 hex digits) leaves ample
room for most TSAs while keeping the placeholder modest.
