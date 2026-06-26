[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfWorkerOptions

# Interface: PdfWorkerOptions

Defined in: [src/browser/worker.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/browser/worker.ts#L31)

Options for creating a [PdfWorker](../classes/PdfWorker.md).

## Properties

### workerUrl?

> `readonly` `optional` **workerUrl?**: `string` \| `URL`

Defined in: [src/browser/worker.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/browser/worker.ts#L40)

URL to a custom worker script. If not provided, an inline worker
is created via `Blob` + `URL.createObjectURL`.

The custom script must import `modern-pdf-lib` and expose the
same message-handling protocol (receive `{ id, taskCode }`,
respond with `{ id, result }` or `{ id, error }`).
