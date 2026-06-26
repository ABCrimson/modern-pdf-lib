# Form Scripting

PDF forms can contain JavaScript that runs inside a PDF viewer (such as Adobe Acrobat or Foxit Reader) to automate calculations, validate input, format values, and respond to document-level events. **modern-pdf-lib** provides a comprehensive API for embedding these scripts and a secure sandbox for executing them server-side.

## Overview

Form scripting enables:

- **Calculated fields** -- auto-compute totals, taxes, discounts from other fields
- **Input validation** -- enforce email formats, phone numbers, numeric ranges
- **Dynamic formatting** -- display numbers as currency, dates in locale-specific patterns
- **Conditional visibility** -- show or hide form sections based on user selections
- **Document actions** -- run scripts on open, close, print, or save events

All scripts are embedded as standard PDF JavaScript actions, compatible with any viewer that supports the Acrobat JavaScript API (ISO 32000).

---

## Calculation Scripts

The most common use case is auto-calculating field values. The Acrobat API provides `AFSimple_Calculate` for basic operations.

### Sum, Average, Product, Min, Max

```ts
import { createPdf, PdfForm, PdfDict, PdfName, PdfString } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

// createTextField(name, pageIndex, rect) where rect is [x1, y1, x2, y2].
// Create line item fields on the first page (index 0).
form.createTextField('item1', 0, [100, 700, 200, 724]);
form.createTextField('item2', 0, [100, 670, 200, 694]);
form.createTextField('item3', 0, [100, 640, 200, 664]);

// Create a total field, then attach a SUM calculation as its calculate
// action (the widget's /AA → /C JavaScript entry) so viewers recompute it.
const total = form.createTextField('total', 0, [100, 600, 200, 624]);

const calcAction = new PdfDict();
calcAction.set('/S', PdfName.of('JavaScript'));
calcAction.set('/JS', PdfString.literal('AFSimple_Calculate("SUM", ["item1", "item2", "item3"]);'));
const aa = new PdfDict();
aa.set('/C', calcAction);
total.getWidgetDict().set('/AA', aa);
```

### Custom Calculation Scripts

A small helper keeps the rest of the examples concise. It attaches a piece of
JavaScript to a field's additional-actions dictionary using the public PDF
object API. The action key follows ISO 32000: `/C` = calculate, `/F` = format,
`/V` = validate, `/K` = keystroke.

```ts
import { PdfDict, PdfName, PdfString } from 'modern-pdf-lib';
import type { PdfField } from 'modern-pdf-lib';

function setFieldScript(field: PdfField, key: '/C' | '/F' | '/V' | '/K', js: string) {
  const action = new PdfDict();
  action.set('/S', PdfName.of('JavaScript'));
  action.set('/JS', PdfString.literal(js));

  const widget = field.getWidgetDict();
  let aa = widget.get('/AA');
  if (aa === undefined || aa.kind !== 'dict') {
    aa = new PdfDict();
    widget.set('/AA', aa);
  }
  (aa as PdfDict).set(key, action);
}
```

For more complex calculations (e.g., applying tax or discounts):

```ts
const subtotal = form.createTextField('subtotal', 0, [100, 560, 200, 584]);
setFieldScript(subtotal, '/C', `
  var qty = parseFloat(getField("quantity").value) || 0;
  var price = parseFloat(getField("unitPrice").value) || 0;
  event.value = (qty * price).toFixed(2);
`);

const tax = form.createTextField('tax', 0, [100, 530, 200, 554]);
setFieldScript(tax, '/C', `
  var subtotal = parseFloat(getField("subtotal").value) || 0;
  var taxRate = 0.085; // 8.5%
  event.value = (subtotal * taxRate).toFixed(2);
`);

const grandTotal = form.createTextField('grandTotal', 0, [100, 500, 200, 524]);
setFieldScript(grandTotal, '/C', `
  var subtotal = parseFloat(getField("subtotal").value) || 0;
  var tax = parseFloat(getField("tax").value) || 0;
  event.value = (subtotal + tax).toFixed(2);
`);
```

---

## Number Formatting

`AFNumber_Format` controls how numeric values display in fields.

```ts
// Format with 2 decimal places, comma separators, dollar sign
const price = form.createTextField('price', 0, [100, 460, 220, 484]);
setFieldScript(price, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", false);');
// Input: 1234.5 -> Display: $1,234.50
```

### AFNumber_Format Parameters

| Parameter | Description |
|-----------|-------------|
| `nDec` | Number of decimal places |
| `sepStyle` | Separator style: 0 = `1,234.56`, 1 = `1234.56`, 2 = `1.234,56`, 3 = `1234,56` |
| `negStyle` | Negative style: 0 = minus, 1 = red, 2 = parens, 3 = red+parens |
| `currStyle` | Ignored (legacy) |
| `strCurrency` | Currency symbol string |
| `bCurrencyPrepend` | `true` to prepend currency, `false` to append |

### Server-Side Formatting

You can also format values programmatically without embedding scripts:

```ts
import { formatNumber } from 'modern-pdf-lib';

const formatted = formatNumber(1234.5, {
  decimals: 2,
  thousandsSep: ',',
  decimalSep: '.',
  currency: '$',
  currencyPrepend: true,
});
// "$1,234.50"
```

---

## Date Fields

Use `AFDate_FormatEx` to display and validate dates.

```ts
const birthDate = form.createTextField('birthDate', 0, [100, 420, 220, 444]);
setFieldScript(birthDate, '/F', 'AFDate_FormatEx("mm/dd/yyyy");');
setFieldScript(birthDate, '/K', 'AFDate_KeystrokeEx("mm/dd/yyyy");');
```

### Common Date Patterns

| Pattern | Example | Description |
|---------|---------|-------------|
| `mm/dd/yyyy` | 03/07/2026 | US date |
| `dd/mm/yyyy` | 07/03/2026 | European date |
| `yyyy-mm-dd` | 2026-03-07 | ISO 8601 |
| `mmmm d, yyyy` | March 7, 2026 | Long format |
| `mm/dd/yy` | 03/07/26 | Short year |
| `d-mmm-yyyy` | 7-Mar-2026 | Abbreviated month |

### Server-Side Date Handling

```ts
import { AFDate_FormatEx, parseAcrobatDate, formatAcrobatDate } from 'modern-pdf-lib';

const date = parseAcrobatDate('03/07/2026', 'mm/dd/yyyy');
const iso = formatAcrobatDate(date, 'yyyy-mm-dd'); // "2026-03-07"
```

---

## Validation

Field validation scripts run on the `keystroke` or `validate` event to enforce input constraints.

### Email Validation

```ts
const email = form.createTextField('email', 0, [100, 380, 300, 404]);
setFieldScript(email, '/V', `
  var email = event.value;
  var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!re.test(email) && email !== "") {
    app.alert("Please enter a valid email address.");
    event.rc = false;
  }
`);
```

### Phone Number Validation

```ts
const phone = form.createTextField('phone', 0, [100, 340, 300, 364]);
setFieldScript(phone, '/V', `
  var phone = event.value.replace(/[^0-9]/g, "");
  if (phone.length > 0 && phone.length !== 10) {
    app.alert("Phone number must be 10 digits.");
    event.rc = false;
  }
`);
```

### Numeric Range

```ts
const age = form.createTextField('age', 0, [100, 300, 180, 324]);
setFieldScript(age, '/V', `
  var val = parseInt(event.value);
  if (isNaN(val) || val < 0 || val > 150) {
    app.alert("Age must be between 0 and 150.");
    event.rc = false;
  }
`);
```

### Server-Side Validation

```ts
import { validateFieldValue } from 'modern-pdf-lib';

// validateFieldValue(field, value, script) inspects the Acrobat validation
// script to decide which built-in check to run (email, phone, range, etc.).
const emailField = form.getField('email');
const emailScript = 'if (!isValidEmail(event.value)) { app.alert("Invalid email@address"); }';

const result = validateFieldValue(emailField, 'test@example.com', emailScript);
// { valid: true }

const bad = validateFieldValue(emailField, 'not-an-email', emailScript);
// { valid: false, message: '...' }
```

---

## Special Formats

`AFSpecial_Format` handles common masked-input patterns.

```ts
// Social Security Number: 123-45-6789
const ssn = form.createTextField('ssn', 0, [100, 260, 220, 284]);
setFieldScript(ssn, '/F', 'AFSpecial_Format(3);');
setFieldScript(ssn, '/K', 'AFSpecial_Keystroke(3);');

// Phone number: (123) 456-7890
const phone = form.createTextField('phone', 0, [100, 230, 220, 254]);
setFieldScript(phone, '/F', 'AFSpecial_Format(2);');
setFieldScript(phone, '/K', 'AFSpecial_Keystroke(2);');

// ZIP code: 12345
const zip = form.createTextField('zip', 0, [100, 200, 180, 224]);
setFieldScript(zip, '/F', 'AFSpecial_Format(0);');
setFieldScript(zip, '/K', 'AFSpecial_Keystroke(0);');

// ZIP+4: 12345-6789
const zip4 = form.createTextField('zip4', 0, [100, 170, 200, 194]);
setFieldScript(zip4, '/F', 'AFSpecial_Format(1);');
setFieldScript(zip4, '/K', 'AFSpecial_Keystroke(1);');
```

### AFSpecial_Format Codes

| Code | Format | Example |
|------|--------|---------|
| `0` | ZIP code | `12345` |
| `1` | ZIP+4 | `12345-6789` |
| `2` | Phone | `(123) 456-7890` |
| `3` | SSN | `123-45-6789` |

---

## Cross-Field References

Use `getField()` to read or write values in other form fields from any script.

```ts
import { PdfDict, PdfName, PdfString } from 'modern-pdf-lib';

// Toggle a "same as billing" address
form.createTextField('billingAddress', 0, [100, 130, 300, 154]);

const sameAsBilling = form.createCheckbox('sameAsBilling', 0, [100, 100, 116, 116]);

// A checkbox runs its activation action (/A) when clicked.
const onClick = new PdfDict();
onClick.set('/S', PdfName.of('JavaScript'));
onClick.set('/JS', PdfString.literal(`
  var same = getField("sameAsBilling").value === "Yes";
  var billing = getField("billingAddress").value;
  if (same) {
    getField("shippingAddress").value = billing;
  }
`));
sameAsBilling.getWidgetDict().set('/A', onClick);

form.createTextField('shippingAddress', 0, [100, 70, 300, 94]);
```

### Server-Side Field References

```ts
import { resolveFieldReference, getFieldValue, setFieldValue } from 'modern-pdf-lib';

// Programmatically read/write field values
const value = getFieldValue(form, 'billingAddress');
setFieldValue(form, 'shippingAddress', value);
```

---

## Field Visibility

Show or hide form sections based on field values.

```ts
import { setFieldVisibility, addVisibilityAction } from 'modern-pdf-lib';

// setFieldVisibility(field, visible) — pass the field object, not its name.
const spouseName = form.getField('spouseName');
const spouseSSN = form.getField('spouseSSN');

// Hide the "spouse" section by default
setFieldVisibility(spouseName, false);
setFieldVisibility(spouseSSN, false);

// Attach a value-changed action to each spouse field that re-shows it when
// the "maritalStatus" field equals "Married".
// addVisibilityAction(field, triggerField, { operator, value? })
addVisibilityAction(spouseName, 'maritalStatus', { operator: 'equals', value: 'Married' });
addVisibilityAction(spouseSSN, 'maritalStatus', { operator: 'equals', value: 'Married' });
```

### Script-Based Visibility

```ts
// createDropdown(name, pageIndex, rect, options)
const filingStatus = form.createDropdown('filingStatus', 0, [100, 500, 250, 524], [
  'Single', 'Married Filing Jointly', 'Head of Household',
]);

// Run on the value-changed event (/AA → /V)
setFieldScript(filingStatus, '/V', `
  var status = getField("filingStatus").value;
  var show = (status === "Married Filing Jointly");
  getField("spouseName").display = show ? display.visible : display.hidden;
  getField("spouseSSN").display = show ? display.visible : display.hidden;
`);
```

---

## Document Actions

Document-level actions trigger on lifecycle events: open, close, print, and save.

Document-level scripts are registered with `doc.addJavaScript(name, script)`.
Viewers (Adobe Acrobat, Foxit) execute these when the document opens; named
scripts run in name order. Use them to install global helpers and to wire up
the field-level actions that fire on the close, print, and save events.

### Open Action

```ts
import { createPdf } from 'modern-pdf-lib';

const doc = createPdf();
doc.addJavaScript('welcome', 'app.alert("Welcome to this form!");');
```

### Close Action

```ts
doc.addJavaScript('onClose', `
  this.setAction("WillClose", 'if (this.dirty) app.alert("You have unsaved changes.");');
`);
```

### Print Actions

```ts
doc.addJavaScript('onPrint', `
  this.setAction("WillPrint", 'getField("printDate").value = util.printd("mm/dd/yyyy", new Date()); getField("watermark").display = display.visible;');
  this.setAction("DidPrint", 'getField("watermark").display = display.hidden;');
`);
```

### Save Actions

```ts
doc.addJavaScript('onSave', `
  this.setAction("WillSave", 'getField("lastModified").value = util.printd("yyyy-mm-dd HH:MM:ss", new Date());');
  this.setAction("DidSave", 'app.alert("Document saved successfully.");');
`);
```

### Named Document Scripts

For scripts that run automatically on document open (in name order):

```ts
doc.addJavaScript('00_init', `
  // Initialize global variables
  var taxRate = 0.085;
  var discountThreshold = 1000;
`);

doc.addJavaScript('01_setup', `
  // Set default values
  getField("date").value = util.printd("mm/dd/yyyy", new Date());
`);
```

---

## Sandbox Security

When executing form scripts on the server (e.g., for pre-filling or validation), the sandbox prevents malicious scripts from accessing the host environment.

### Creating a Sandbox

```ts
import { createSandbox } from 'modern-pdf-lib';

const sandbox = createSandbox({
  timeout: 1000,     // Max execution time (ms)
  maxMemory: 10_000_000, // Memory limit (bytes, advisory)
});
```

### Executing Scripts

```ts
sandbox.setFieldValues(new Map([
  ['quantity', '5'],
  ['unitPrice', '29.99'],
]));

const result = sandbox.execute(`
  var qty = parseFloat(getField("quantity").value);
  var price = parseFloat(getField("unitPrice").value);
  getField("total").value = String(qty * price);
  return qty * price;
`);

if (result.success) {
  console.log('Total:', result.returnValue); // 149.95
  console.log('Time:', result.executionTimeMs, 'ms');
} else {
  console.error('Script error:', result.error);
}

// Read updated values
const values = sandbox.getFieldValues();
console.log('total =', values.get('total')); // "149.95"
```

### What the Sandbox Blocks

The sandbox prevents access to:

| Category | Blocked APIs |
|----------|-------------|
| **Network** | `fetch()`, `XMLHttpRequest`, `WebSocket` |
| **Code generation** | `eval()`, `Function()`, `import()` |
| **Environment** | `globalThis`, `window`, `document`, `process` |
| **Modules** | `require()`, dynamic `import()` |
| **Concurrency** | `Worker`, `SharedWorker` |
| **Metaprogramming** | `Proxy`, `Reflect`, `__proto__`, `.constructor` |

### What the Sandbox Allows

| Category | Available APIs |
|----------|---------------|
| **Math** | `Math.*`, `parseInt`, `parseFloat`, `isNaN`, `isFinite` |
| **Types** | `String`, `Number`, `Boolean`, `Array`, `Date`, `RegExp` |
| **Data** | `JSON.parse`, `JSON.stringify` |
| **PDF** | `getField()`, `event`, `AFSimple_Calculate` |
| **Acrobat** | `app.alert` (no-op), `console.println` (no-op) |

### Cleanup

Always destroy the sandbox when done:

```ts
sandbox.destroy();
```

---

## Real-World Examples

### Invoice Form with Auto-Calculating Totals

```ts
import { createPdf, PdfDict, PdfName, PdfString } from 'modern-pdf-lib';
import type { PdfField } from 'modern-pdf-lib';

// Helper: attach JavaScript to a field's /AA action dictionary.
// /C = calculate, /F = format, /V = validate, /K = keystroke.
function setFieldScript(field: PdfField, key: '/C' | '/F' | '/V' | '/K', js: string) {
  const action = new PdfDict();
  action.set('/S', PdfName.of('JavaScript'));
  action.set('/JS', PdfString.literal(js));
  const widget = field.getWidgetDict();
  let aa = widget.get('/AA');
  if (aa === undefined || aa.kind !== 'dict') {
    aa = new PdfDict();
    widget.set('/AA', aa);
  }
  (aa as PdfDict).set(key, action);
}

const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

// Header
page.drawText('INVOICE', { x: 50, y: 742, size: 24 });

// Line items (3 rows x 3 columns: Description, Qty, Price)
for (let i = 1; i <= 3; i++) {
  const y = 700 - (i - 1) * 30;

  form.createTextField(`desc${i}`, 0, [50, y, 250, y + 24]);
  form.createTextField(`qty${i}`, 0, [260, y, 320, y + 24]);
  form.createTextField(`price${i}`, 0, [330, y, 410, y + 24]);

  const line = form.createTextField(`line${i}`, 0, [420, y, 500, y + 24]);
  setFieldScript(line, '/C', `
    var q = parseFloat(getField("qty${i}").value) || 0;
    var p = parseFloat(getField("price${i}").value) || 0;
    event.value = (q * p).toFixed(2);
  `);
  setFieldScript(line, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');
}

// Subtotal
const subtotal = form.createTextField('subtotal', 0, [420, 580, 500, 604]);
setFieldScript(subtotal, '/C', 'AFSimple_Calculate("SUM", ["line1", "line2", "line3"]);');
setFieldScript(subtotal, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');

// Tax (8.5%)
const tax = form.createTextField('tax', 0, [420, 550, 500, 574]);
setFieldScript(tax, '/C', `
  var sub = parseFloat(getField("subtotal").value) || 0;
  event.value = (sub * 0.085).toFixed(2);
`);
setFieldScript(tax, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');

// Grand total
const grandTotal = form.createTextField('grandTotal', 0, [420, 520, 500, 544]);
setFieldScript(grandTotal, '/C', 'AFSimple_Calculate("SUM", ["subtotal", "tax"]);');
setFieldScript(grandTotal, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');

// Set today's date when the document opens
doc.addJavaScript('invoiceDate', `
  getField("invoiceDate").value = util.printd("mm/dd/yyyy", new Date());
`);

const bytes = await doc.save();
```

### Tax Form with Conditional Sections

```ts
// Reuses the setFieldScript() helper defined in the invoice example above.
const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

// Filing status dropdown
const filingStatus = form.createDropdown('filingStatus', 0, [150, 700, 350, 724], [
  'Single', 'Married Filing Jointly', 'Married Filing Separately',
]);
setFieldScript(filingStatus, '/V', `
  var status = event.value;
  var married = (status === "Married Filing Jointly" ||
                 status === "Married Filing Separately");
  getField("spouseName").display = married ? display.visible : display.hidden;
  getField("spouseSSN").display = married ? display.visible : display.hidden;
`);

// Spouse fields (hidden by default)
form.createTextField('spouseName', 0, [150, 660, 350, 684]);
const spouseSSN = form.createTextField('spouseSSN', 0, [150, 630, 270, 654]);
setFieldScript(spouseSSN, '/F', 'AFSpecial_Format(3);');

// Income fields
const wages = form.createTextField('wages', 0, [150, 580, 270, 604]);
setFieldScript(wages, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');
const interest = form.createTextField('interest', 0, [150, 550, 270, 574]);
setFieldScript(interest, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');

// Total income
const totalIncome = form.createTextField('totalIncome', 0, [150, 510, 270, 534]);
setFieldScript(totalIncome, '/C', 'AFSimple_Calculate("SUM", ["wages", "interest"]);');
setFieldScript(totalIncome, '/F', 'AFNumber_Format(2, 0, 0, 0, "$", true);');
```

### Registration Form with Validation

```ts
const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

page.drawText('Registration Form', { x: 50, y: 742, size: 20 });

// Reuses the setFieldScript() helper defined in the invoice example above.

// Name (required)
const fullName = form.createTextField('fullName', 0, [150, 700, 400, 724]);
setFieldScript(fullName, '/V', `
  if (event.value.trim() === "") {
    app.alert("Full name is required.");
    event.rc = false;
  }
`);

// Email
const email = form.createTextField('email', 0, [150, 660, 400, 684]);
setFieldScript(email, '/V', `
  var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (event.value !== "" && !re.test(event.value)) {
    app.alert("Please enter a valid email address.");
    event.rc = false;
  }
`);

// Phone
const phone = form.createTextField('phone', 0, [150, 620, 300, 644]);
setFieldScript(phone, '/F', 'AFSpecial_Format(2);');
setFieldScript(phone, '/K', 'AFSpecial_Keystroke(2);');

// Date of birth
const dob = form.createTextField('dob', 0, [150, 580, 270, 604]);
setFieldScript(dob, '/F', 'AFDate_FormatEx("mm/dd/yyyy");');
setFieldScript(dob, '/K', 'AFDate_KeystrokeEx("mm/dd/yyyy");');

// Server-side pre-validation with sandbox
import { createSandbox } from 'modern-pdf-lib';

const sandbox = createSandbox();
sandbox.setFieldValues(new Map([
  ['fullName', 'Jane Doe'],
  ['email', 'jane@example.com'],
  ['phone', '5551234567'],
]));

const result = sandbox.execute(`
  var name = getField("fullName").value;
  var email = getField("email").value;
  var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return {
    nameValid: name.trim() !== "",
    emailValid: re.test(email),
  };
`);

console.log(result.returnValue);
// { nameValid: true, emailValid: true }

sandbox.destroy();
```

---

## Limitations

The form scripting system in modern-pdf-lib covers the most commonly used subset of the Acrobat JavaScript API. The following features are **not** currently supported:

| Feature | Status | Notes |
|---------|--------|-------|
| Full `app` object | Partial | `app.alert` and `app.beep` are no-ops in sandbox |
| `this` (document object) | Not supported | Use `getField()` for field access |
| `util.printd` / `util.scand` | Not supported | Use `AFDate_FormatEx` instead |
| `console.println` | No-op | Available but does not output |
| `event.target` | Partial | Basic stub only |
| `color` object | Not supported | Use CSS-style colors in appearances |
| `Collab` / `SOAP` / `Net` | Not supported | Security-sensitive APIs |
| `ADBC` (database) | Not supported | Server-side only in Acrobat |
| Privileged context | Not supported | `app.trustedFunction` not available |
| `spell` object | Not supported | Spell-check is viewer-dependent |

For features not listed here, scripts will still be embedded in the PDF and will work in viewers that support them (Adobe Acrobat, Foxit Reader). The sandbox only executes the subset described above.
