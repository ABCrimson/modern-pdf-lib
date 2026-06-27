[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / addVisibilityAction

# Function: addVisibilityAction()

```ts
function addVisibilityAction(
   field, 
   triggerField, 
   condition): void;
```

Defined in: [src/form/fieldVisibility.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldVisibility.ts#L158)

Add a JavaScript action to a field that toggles the visibility of
another field based on a condition.

This creates an `/AA` (additional actions) entry with a `/V`
(value-changed) trigger containing a JavaScript action. The script
reads the trigger field's value and shows/hides the target field
according to the given condition.

Note: The generated JavaScript uses Acrobat's `getField()` API and
`display` property. It will only execute in viewers that support
JavaScript (e.g., Adobe Acrobat, Foxit).

## Parameters

### field

[`PdfField`](../classes/PdfField.md)

The field to attach the action to (trigger).

### triggerField

`string`

The name of the field whose value is checked.

### condition

`VisibilityCondition`

The condition to evaluate.

## Returns

`void`
