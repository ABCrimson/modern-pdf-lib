[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfWorker

# Class: PdfWorker

Defined in: [src/browser/worker.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/browser/worker.ts#L74)

Manages a Web Worker for PDF generation tasks.

Each call to [generate](#generate) serializes the task function as a
string, sends it to the worker, and returns the resulting PDF bytes.
The worker is created lazily on the first `generate()` call.

**Important:** The task function is serialized via `.toString()` and
reconstructed with `new Function()` inside the worker. This means:

- The function **cannot** close over variables from the calling scope.
- It receives the full `modern-pdf-lib` module as its sole argument.
- It must return a `Promise<Uint8Array>` (typically from `doc.save()`).

## Constructors

### Constructor

> **new PdfWorker**(`options?`): `PdfWorker`

Defined in: [src/browser/worker.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/browser/worker.ts#L83)

#### Parameters

##### options?

[`PdfWorkerOptions`](../interfaces/PdfWorkerOptions.md) = `{}`

#### Returns

`PdfWorker`

## Accessors

### isActive

#### Get Signature

> **get** **isActive**(): `boolean`

Defined in: [src/browser/worker.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/browser/worker.ts#L133)

Whether the worker is currently active (has been created and not yet terminated).

##### Returns

`boolean`

***

### pendingCount

#### Get Signature

> **get** **pendingCount**(): `number`

Defined in: [src/browser/worker.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/browser/worker.ts#L138)

Number of in-flight tasks awaiting a response.

##### Returns

`number`

## Methods

### generate()

> **generate**(`taskFn`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/browser/worker.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/browser/worker.ts#L107)

Generate a PDF in the worker thread.

#### Parameters

##### taskFn

(`pdf`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

A function that receives the `modern-pdf-lib`
                module and returns PDF bytes. This function is
                serialized to a string and executed in the worker,
                so it **must not** reference any outer-scope
                variables.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The generated PDF as a `Uint8Array`.

#### Example

```ts
const bytes = await worker.generate(async (pdf) => {
  const doc = pdf.createPdf();
  const page = doc.addPage(pdf.PageSizes.A4);
  page.drawText('Generated in a worker', { x: 50, y: 750, size: 18 });
  return doc.save();
});
```

***

### terminate()

> **terminate**(): `void`

Defined in: [src/browser/worker.ts:121](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/browser/worker.ts#L121)

Terminate the worker and reject all pending tasks.

#### Returns

`void`
