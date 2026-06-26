[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPieceInfo

# Function: buildPieceInfo()

> **buildPieceInfo**(`appName`, `privateData`, `lastModified?`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/pieceInfo.ts:40

Build a `/PieceInfo` dictionary containing a single application data
dictionary.

## Parameters

### appName

`string`

The producing application's name; becomes the key of
                     the data dictionary inside `/PieceInfo` (the leading
                     `/` is optional and added if missing).

### privateData

[`PdfDict`](../classes/PdfDict.md)

The application-private data dictionary stored under
                     `/Private`.

### lastModified?

`Date`

Modification timestamp for `/LastModified`; defaults
                     to the current time.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A `/PieceInfo` dictionary with one entry keyed by
                     `appName`.
