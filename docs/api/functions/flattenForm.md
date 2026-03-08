[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenForm

# Function: flattenForm()

> **flattenForm**(`form`, `options?`): [`FlattenFormResult`](../interfaces/FlattenFormResult.md)

Defined in: src/form/formFlatten.ts:261

Flatten ALL form fields into static page content.

For each field in the document's AcroForm:
1. Generate / retrieve the field's appearance stream
2. Embed the appearance as a Form XObject in the page's content stream
3. Remove the widget annotation from the page
4. Remove the field from the AcroForm

After all fields are processed, the /AcroForm dictionary is cleared.

## Parameters

### form

[`PdfForm`](../classes/PdfForm.md)

The document's PdfForm.

### options?

[`FlattenOptions`](../interfaces/FlattenOptions.md) = `{}`

Optional flatten options.

## Returns

[`FlattenFormResult`](../interfaces/FlattenFormResult.md)

An object describing the flatten operations performed, suitable
         for the caller to apply to page content streams and resources.
