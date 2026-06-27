[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPieceInfo

# Function: buildPieceInfo()

```ts
function buildPieceInfo(
   appName, 
   privateData, 
   lastModified?): PdfDict;
```

Defined in: [src/core/pieceInfo.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pieceInfo.ts#L40)

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
