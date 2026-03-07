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
import { createPdf, PdfForm } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

// Create line item fields
form.createTextField('item1', { page, x: 100, y: 700, width: 100, height: 24 });
form.createTextField('item2', { page, x: 100, y: 670, width: 100, height: 24 });
form.createTextField('item3', { page, x: 100, y: 640, width: 100, height: 24 });

// Create a total field with a SUM calculation
form.createTextField('total', {
  page, x: 100, y: 600, width: 100, height: 24,
  calculateScript: 'AFSimple_Calculate("SUM", ["item1", "item2", "item3"]);',
});
```

### Custom Calculation Scripts

For more complex calculations (e.g., applying tax or discounts):

```ts
form.createTextField('subtotal', {
  page, x: 100, y: 560, width: 100, height: 24,
  calculateScript: `
    var qty = parseFloat(getField("quantity").value) || 0;
    var price = parseFloat(getField("unitPrice").value) || 0;
    event.value = (qty * price).toFixed(2);
  `,
});

form.createTextField('tax', {
  page, x: 100, y: 530, width: 100, height: 24,
  calculateScript: `
    var subtotal = parseFloat(getField("subtotal").value) || 0;
    var taxRate = 0.085; // 8.5%
    event.value = (subtotal * taxRate).toFixed(2);
  `,
});

form.createTextField('grandTotal', {
  page, x: 100, y: 500, width: 100, height: 24,
  calculateScript: `
    var subtotal = parseFloat(getField("subtotal").value) || 0;
    var tax = parseFloat(getField("tax").value) || 0;
    event.value = (subtotal + tax).toFixed(2);
  `,
});
```

---

## Number Formatting

`AFNumber_Format` controls how numeric values display in fields.

```ts
import { AFNumber_Format } from 'modern-pdf-lib';

// Format with 2 decimal places, comma separators, dollar sign
form.createTextField('price', {
  page, x: 100, y: 460, width: 120, height: 24,
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", false);',
});
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
import { AFNumber_Format, formatNumber } from 'modern-pdf-lib';

const formatted = formatNumber(1234.5, {
  decimals: 2,
  separatorStyle: 0,
  currency: '$',
  currencyPrepend: true,
});
// "$1,234.50"
```

---

## Date Fields

Use `AFDate_FormatEx` to display and validate dates.

```ts
form.createTextField('birthDate', {
  page, x: 100, y: 420, width: 120, height: 24,
  formatScript: 'AFDate_FormatEx("mm/dd/yyyy");',
  keystrokeScript: 'AFDate_KeystrokeEx("mm/dd/yyyy");',
});
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
import { AFDate_FormatEx, parseAcrobatDate, formatDate } from 'modern-pdf-lib';

const date = parseAcrobatDate('03/07/2026', 'mm/dd/yyyy');
const iso = formatDate(date, 'yyyy-mm-dd'); // "2026-03-07"
```

---

## Validation

Field validation scripts run on the `keystroke` or `validate` event to enforce input constraints.

### Email Validation

```ts
form.createTextField('email', {
  page, x: 100, y: 380, width: 200, height: 24,
  validateScript: `
    var email = event.value;
    var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!re.test(email) && email !== "") {
      app.alert("Please enter a valid email address.");
      event.rc = false;
    }
  `,
});
```

### Phone Number Validation

```ts
form.createTextField('phone', {
  page, x: 100, y: 340, width: 200, height: 24,
  validateScript: `
    var phone = event.value.replace(/[^0-9]/g, "");
    if (phone.length > 0 && phone.length !== 10) {
      app.alert("Phone number must be 10 digits.");
      event.rc = false;
    }
  `,
});
```

### Numeric Range

```ts
form.createTextField('age', {
  page, x: 100, y: 300, width: 80, height: 24,
  validateScript: `
    var val = parseInt(event.value);
    if (isNaN(val) || val < 0 || val > 150) {
      app.alert("Age must be between 0 and 150.");
      event.rc = false;
    }
  `,
});
```

### Server-Side Validation

```ts
import { validateFieldValue } from 'modern-pdf-lib';

const result = validateFieldValue('test@example.com', {
  type: 'email',
});
// { valid: true }

const bad = validateFieldValue('not-an-email', {
  type: 'email',
});
// { valid: false, message: '...' }
```

---

## Special Formats

`AFSpecial_Format` handles common masked-input patterns.

```ts
import { AFSpecial_Format } from 'modern-pdf-lib';

// Social Security Number: 123-45-6789
form.createTextField('ssn', {
  page, x: 100, y: 260, width: 120, height: 24,
  formatScript: 'AFSpecial_Format(3);',
  keystrokeScript: 'AFSpecial_Keystroke(3);',
});

// Phone number: (123) 456-7890
form.createTextField('phone', {
  page, x: 100, y: 230, width: 120, height: 24,
  formatScript: 'AFSpecial_Format(2);',
  keystrokeScript: 'AFSpecial_Keystroke(2);',
});

// ZIP code: 12345
form.createTextField('zip', {
  page, x: 100, y: 200, width: 80, height: 24,
  formatScript: 'AFSpecial_Format(0);',
  keystrokeScript: 'AFSpecial_Keystroke(0);',
});

// ZIP+4: 12345-6789
form.createTextField('zip4', {
  page, x: 100, y: 170, width: 100, height: 24,
  formatScript: 'AFSpecial_Format(1);',
  keystrokeScript: 'AFSpecial_Keystroke(1);',
});
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
// Toggle a "same as billing" address
form.createTextField('billingAddress', {
  page, x: 100, y: 130, width: 200, height: 24,
});

form.createCheckbox('sameAsBilling', {
  page, x: 100, y: 100, width: 16, height: 16,
  actionScript: `
    var same = getField("sameAsBilling").value === "Yes";
    var billing = getField("billingAddress").value;
    if (same) {
      getField("shippingAddress").value = billing;
    }
  `,
});

form.createTextField('shippingAddress', {
  page, x: 100, y: 70, width: 200, height: 24,
});
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

// Hide the "spouse" section by default
setFieldVisibility(form, 'spouseName', false);
setFieldVisibility(form, 'spouseSSN', false);

// Show it when "Married" is selected
addVisibilityAction(form, 'maritalStatus', {
  condition: (value) => value === 'Married',
  targetFields: ['spouseName', 'spouseSSN'],
});
```

### Script-Based Visibility

```ts
form.createDropdown('filingStatus', {
  page, x: 100, y: 500, width: 150, height: 24,
  options: ['Single', 'Married Filing Jointly', 'Head of Household'],
  actionScript: `
    var status = getField("filingStatus").value;
    var show = (status === "Married Filing Jointly");
    getField("spouseName").display = show ? display.visible : display.hidden;
    getField("spouseSSN").display = show ? display.visible : display.hidden;
  `,
});
```

---

## Document Actions

Document-level actions trigger on lifecycle events: open, close, print, and save.

### Open Action

```ts
import { createPdf } from 'modern-pdf-lib';
import { addDocumentOpenAction } from 'modern-pdf-lib/form';

const doc = createPdf();
addDocumentOpenAction(doc, 'app.alert("Welcome to this form!");');
```

### Close Action

```ts
import { addDocumentCloseAction } from 'modern-pdf-lib/form';

addDocumentCloseAction(doc, `
  if (this.dirty) {
    app.alert("You have unsaved changes.");
  }
`);
```

### Print Actions

```ts
import { addDocumentPrintAction } from 'modern-pdf-lib/form';

addDocumentPrintAction(doc, {
  beforePrint: `
    getField("printDate").value = util.printd("mm/dd/yyyy", new Date());
    getField("watermark").display = display.visible;
  `,
  afterPrint: `
    getField("watermark").display = display.hidden;
  `,
});
```

### Save Actions

```ts
import { addDocumentSaveAction } from 'modern-pdf-lib/form';

addDocumentSaveAction(doc, {
  beforeSave: `
    getField("lastModified").value = util.printd("yyyy-mm-dd HH:MM:ss", new Date());
  `,
  afterSave: `
    app.alert("Document saved successfully.");
  `,
});
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
import { createPdf } from 'modern-pdf-lib';
import { addDocumentOpenAction } from 'modern-pdf-lib/form';

const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

// Header
page.drawText('INVOICE', { x: 50, y: 742, size: 24 });

// Line items (3 rows x 3 columns: Description, Qty, Price)
for (let i = 1; i <= 3; i++) {
  const y = 700 - (i - 1) * 30;

  form.createTextField(`desc${i}`, { page, x: 50, y, width: 200, height: 24 });
  form.createTextField(`qty${i}`,  { page, x: 260, y, width: 60, height: 24 });
  form.createTextField(`price${i}`, { page, x: 330, y, width: 80, height: 24 });
  form.createTextField(`line${i}`, {
    page, x: 420, y, width: 80, height: 24,
    calculateScript: `
      var q = parseFloat(getField("qty${i}").value) || 0;
      var p = parseFloat(getField("price${i}").value) || 0;
      event.value = (q * p).toFixed(2);
    `,
    formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
  });
}

// Subtotal
form.createTextField('subtotal', {
  page, x: 420, y: 580, width: 80, height: 24,
  calculateScript: 'AFSimple_Calculate("SUM", ["line1", "line2", "line3"]);',
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
});

// Tax (8.5%)
form.createTextField('tax', {
  page, x: 420, y: 550, width: 80, height: 24,
  calculateScript: `
    var sub = parseFloat(getField("subtotal").value) || 0;
    event.value = (sub * 0.085).toFixed(2);
  `,
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
});

// Grand total
form.createTextField('grandTotal', {
  page, x: 420, y: 520, width: 80, height: 24,
  calculateScript: 'AFSimple_Calculate("SUM", ["subtotal", "tax"]);',
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
});

// Set today's date on open
addDocumentOpenAction(doc, `
  getField("invoiceDate").value = util.printd("mm/dd/yyyy", new Date());
`);

const bytes = await doc.save();
```

### Tax Form with Conditional Sections

```ts
const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

// Filing status dropdown
form.createDropdown('filingStatus', {
  page, x: 150, y: 700, width: 200, height: 24,
  options: ['Single', 'Married Filing Jointly', 'Married Filing Separately'],
  actionScript: `
    var status = event.value;
    var married = (status === "Married Filing Jointly" ||
                   status === "Married Filing Separately");
    getField("spouseName").display = married ? display.visible : display.hidden;
    getField("spouseSSN").display = married ? display.visible : display.hidden;
  `,
});

// Spouse fields (hidden by default)
form.createTextField('spouseName', { page, x: 150, y: 660, width: 200, height: 24 });
form.createTextField('spouseSSN', {
  page, x: 150, y: 630, width: 120, height: 24,
  formatScript: 'AFSpecial_Format(3);',
});

// Income fields
form.createTextField('wages', {
  page, x: 150, y: 580, width: 120, height: 24,
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
});
form.createTextField('interest', {
  page, x: 150, y: 550, width: 120, height: 24,
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
});

// Total income
form.createTextField('totalIncome', {
  page, x: 150, y: 510, width: 120, height: 24,
  calculateScript: 'AFSimple_Calculate("SUM", ["wages", "interest"]);',
  formatScript: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
});
```

### Registration Form with Validation

```ts
const doc = createPdf();
const page = doc.addPage([612, 792]);
const form = doc.getForm();

page.drawText('Registration Form', { x: 50, y: 742, size: 20 });

// Name (required)
form.createTextField('fullName', {
  page, x: 150, y: 700, width: 250, height: 24,
  validateScript: `
    if (event.value.trim() === "") {
      app.alert("Full name is required.");
      event.rc = false;
    }
  `,
});

// Email
form.createTextField('email', {
  page, x: 150, y: 660, width: 250, height: 24,
  validateScript: `
    var re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (event.value !== "" && !re.test(event.value)) {
      app.alert("Please enter a valid email address.");
      event.rc = false;
    }
  `,
});

// Phone
form.createTextField('phone', {
  page, x: 150, y: 620, width: 150, height: 24,
  formatScript: 'AFSpecial_Format(2);',
  keystrokeScript: 'AFSpecial_Keystroke(2);',
});

// Date of birth
form.createTextField('dob', {
  page, x: 150, y: 580, width: 120, height: 24,
  formatScript: 'AFDate_FormatEx("mm/dd/yyyy");',
  keystrokeScript: 'AFDate_KeystrokeEx("mm/dd/yyyy");',
});

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
