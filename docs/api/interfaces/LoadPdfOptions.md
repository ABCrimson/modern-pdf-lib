[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / LoadPdfOptions

# Interface: LoadPdfOptions

Defined in: [src/parser/documentParser.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L50)

Options for loading a PDF document from bytes.

## Properties

### capNumbers?

> `optional` **capNumbers**: `boolean`

Defined in: [src/parser/documentParser.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L79)

When `true`, clamp extreme floating-point values (very large or
very small numbers) to safe ranges during parsing. This prevents
numeric overflows from producing garbage output.

Default: `false`.

***

### ignoreEncryption?

> `optional` **ignoreEncryption**: `boolean`

Defined in: [src/parser/documentParser.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L54)

When true, skip decryption even if the PDF is encrypted.

***

### objectsPerTick?

> `optional` **objectsPerTick**: `number`

Defined in: [src/parser/documentParser.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L65)

Number of objects to process per event-loop tick during parsing.
Lower values keep the main thread more responsive in browsers.
Defaults to `Infinity` (no throttling).

***

### password?

> `optional` **password**: `string`

Defined in: [src/parser/documentParser.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L52)

Password for encrypted PDFs (Phase 5).

***

### throwOnInvalidObject?

> `optional` **throwOnInvalidObject**: `boolean`

Defined in: [src/parser/documentParser.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L71)

When `true`, throw an error if a malformed or invalid PDF object
is encountered during parsing. When `false` (default), malformed
objects are silently skipped.

***

### updateMetadata?

> `optional` **updateMetadata**: `boolean`

Defined in: [src/parser/documentParser.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/parser/documentParser.ts#L59)

When true, update the /ModDate in the /Info dictionary to the
current time when saving. Defaults to true.
