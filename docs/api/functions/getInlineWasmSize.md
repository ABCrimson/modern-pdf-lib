[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getInlineWasmSize

# Function: getInlineWasmSize()

> **getInlineWasmSize**(`name`): `number`

Defined in: [src/wasm/inlineWasm.ts:193](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/inlineWasm.ts#L193)

Get the encoded (base64) size of a WASM module **without** decoding it.

This is useful for diagnostics, size budgeting, and bundle analysis.
The returned value is the number of characters in the base64 string;
the actual binary size is approximately `encodedSize * 3 / 4`.

## Parameters

### name

`string`

The WASM module name.

## Returns

`number`

The base64 string length (in characters), or `0` if the
             module is not available.

## Example

```ts
const encoded = getInlineWasmSize('libdeflate');
const binaryApprox = Math.floor(encoded * 3 / 4);
console.log(`libdeflate: ~${binaryApprox} bytes binary`);
```
