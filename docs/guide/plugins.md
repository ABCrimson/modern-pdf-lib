---
title: Plugins
---

# Plugins

modern-pdf-lib includes an extensible plugin system that lets you intercept and modify behavior at various points in the PDF creation pipeline. Plugins can hook into page creation, font/image embedding, serialization, and catalog/page-dict construction.

---

## Quick Start

Register a plugin on any document using the `.use()` method:

```ts
import { createPdf, timestampPlugin } from 'modern-pdf-lib';

const doc = createPdf();
doc.use(timestampPlugin());

// The timestamp plugin now automatically sets
// creation date on register and modification date before save
const bytes = await doc.save();
```

---

## Built-in Plugins

modern-pdf-lib ships with three built-in plugins that cover common needs.

### timestampPlugin

Automatically manages document timestamps -- sets the creation date when the plugin is registered, and updates the modification date before every save.

```ts
import { timestampPlugin } from 'modern-pdf-lib';

doc.use(timestampPlugin());

// Or configure which timestamps to manage
doc.use(timestampPlugin({
  setCreationDate: true,       // Set creation date on register (default: true)
  setModificationDate: true,   // Update mod date before save (default: true)
}));
```

### metadataPlugin

Sets the producer string and optionally configures default metadata fields:

```ts
import { metadataPlugin } from 'modern-pdf-lib';

doc.use(metadataPlugin({
  producer: 'My Application v3.0',   // Default: 'modern-pdf-lib'
  creator: 'Report Engine',
  defaultTitle: 'Untitled Document',
  defaultAuthor: 'System',
}));
```

### accessibilityPlugin

Adds accessibility features automatically -- sets the document language, marks the catalog for tagged PDF, and enables `DisplayDocTitle` in viewer preferences:

```ts
import { accessibilityPlugin } from 'modern-pdf-lib';

doc.use(accessibilityPlugin({
  language: 'en-US',       // BCP 47 language tag (default: 'en')
  markAsTagged: true,       // Add /MarkInfo with /Marked true (default: true)
}));
```

::: tip Combine Plugins
Plugins execute in registration order. Combining all three built-in plugins gives you automatic timestamps, metadata, and accessibility in a few lines:

```ts
doc.use(timestampPlugin());
doc.use(metadataPlugin({ producer: 'My App' }));
doc.use(accessibilityPlugin({ language: 'de-DE' }));
```
:::

---

## Creating Custom Plugins

A plugin is any object that implements the `PdfPlugin` interface. At minimum, it needs a `name` property. All lifecycle hooks are optional.

### Basic Example

```ts
import type { PdfPlugin, PluginDocument } from 'modern-pdf-lib';

const watermarkPlugin: PdfPlugin = {
  name: 'watermark',
  version: '1.0.0',

  onAfterAddPage(page, doc) {
    // Every new page gets a watermark notice
    // (actual drawing would use the page's drawText API)
    console.log(`Page added: ${page.getWidth()}x${page.getHeight()}`);
  },

  onBeforeSave(doc) {
    console.log(`Saving document with ${doc.getPageCount()} pages`);
  },
};

doc.use(watermarkPlugin);
```

### Factory Function Pattern

For configurable plugins, wrap the plugin object in a factory function:

```ts
import type { PdfPlugin, PluginDocument } from 'modern-pdf-lib';

interface ClassificationOptions {
  level: 'public' | 'internal' | 'confidential' | 'secret';
  department?: string;
}

function classificationPlugin(options: ClassificationOptions): PdfPlugin {
  return {
    name: 'classification',
    version: '1.0.0',

    onRegister(doc: PluginDocument): void {
      doc.setSubject(`Classification: ${options.level}`);
      if (options.department) {
        doc.setKeywords([options.level, options.department]);
      }
    },

    onBeforeSave(doc: PluginDocument): void {
      doc.setModDate(new Date());
    },
  };
}

doc.use(classificationPlugin({ level: 'confidential', department: 'Legal' }));
```

---

## Plugin Lifecycle Hooks

The `PdfPlugin` interface defines the following hooks, all optional:

| Hook | When It Runs | Can Modify |
|---|---|---|
| `onRegister(doc)` | When `.use()` is called | Document metadata |
| `onBeforeAddPage(size)` | Before a page is created | Page size (return modified size) |
| `onAfterAddPage(page, doc)` | After a page is created | Page content |
| `onBeforeEmbedFont(data, options)` | Before font embedding | Font data and options |
| `onBeforeEmbedImage(data)` | Before image embedding | Image data |
| `onBeforeSave(doc)` | Before serialization (may be async) | Document structure |
| `onAfterSave(bytes)` | After serialization (may be async) | Final PDF bytes |
| `onBuildCatalog(catalog)` | During catalog construction | Catalog dictionary entries |
| `onBuildPageDict(pageDict, pageIndex)` | During page dict construction | Page dictionary entries |

### Transform Hooks

Some hooks can transform their input. The return value replaces the original:

```ts
const resizePlugin: PdfPlugin = {
  name: 'force-letter-size',

  onBeforeAddPage(size) {
    // Force all pages to Letter size
    return [612, 792];
  },

  onBeforeEmbedImage(data) {
    // Could compress or convert image data here
    return data;
  },
};
```

### Async Hooks

`onBeforeSave` and `onAfterSave` can return Promises for async operations:

```ts
const auditPlugin: PdfPlugin = {
  name: 'audit-log',

  async onBeforeSave(doc) {
    // Log to an external service before saving
    await fetch('https://audit.example.com/log', {
      method: 'POST',
      body: JSON.stringify({
        pages: doc.getPageCount(),
        timestamp: new Date().toISOString(),
      }),
    });
  },

  async onAfterSave(bytes) {
    // Post-process the final PDF bytes
    console.log(`Final PDF size: ${bytes.length} bytes`);
    return bytes;
  },
};
```

---

## Plugin Manager

Under the hood, plugins are managed by the `PdfPluginManager` class. You can also use it directly for advanced scenarios:

```ts
import { PdfPluginManager } from 'modern-pdf-lib';

const manager = new PdfPluginManager();

manager.register(timestampPlugin());
manager.register(metadataPlugin());

// List registered plugins
for (const plugin of manager.list()) {
  console.log(`${plugin.name} v${plugin.version}`);
}

// Check if any plugins are registered
if (manager.hasPlugins) {
  console.log('Plugins are active');
}

// Retrieve a specific plugin
const ts = manager.get('timestamp');

// Remove a plugin
manager.unregister('timestamp');
```

::: warning Duplicate Names
The plugin manager throws an error if you try to register two plugins with the same `name`. Each plugin must have a unique name string.
:::

---

## Execution Order

Plugins always execute in **registration order**. When multiple plugins define the same hook, they are called sequentially:

```ts
doc.use(pluginA);  // onBeforeSave runs first
doc.use(pluginB);  // onBeforeSave runs second
doc.use(pluginC);  // onBeforeSave runs third
```

For transform hooks (`onBeforeAddPage`, `onBeforeEmbedFont`, `onBeforeEmbedImage`, `onAfterSave`), each plugin receives the output of the previous plugin. This forms a pipeline where plugins can build on each other's transformations.

---

## Best Practices

1. **Give plugins descriptive, unique names** -- the name is used for deduplication and debugging. Use a namespace prefix for third-party plugins (e.g., `'myapp:watermark'`).

2. **Keep plugins focused** -- each plugin should do one thing well. Combine multiple small plugins rather than building one large one.

3. **Use factory functions** -- wrap plugin objects in factory functions that accept options. This makes plugins reusable and configurable.

4. **Handle errors gracefully** -- if a hook throws, it will propagate up to the caller (e.g., `save()` will throw). Consider wrapping risky operations in try/catch within your hooks.

5. **Prefer `onBeforeSave` for final adjustments** -- this hook runs after all content has been added and before serialization, making it the ideal place for last-minute modifications.

6. **Use `onBuildCatalog` for custom catalog entries** -- this is the cleanest way to add custom dictionary entries to the document catalog without reaching into internal APIs.

---

## API Reference

| Export | Description |
|---|---|
| `PdfPluginManager` | Plugin registration and hook execution manager |
| `PdfPlugin` | Plugin interface with lifecycle hooks |
| `PluginDocument` | Minimal document shape visible to plugins |
| `PluginPage` | Minimal page shape visible to plugins |
| `timestampPlugin(options?)` | Built-in timestamp management plugin |
| `metadataPlugin(options?)` | Built-in metadata management plugin |
| `accessibilityPlugin(options?)` | Built-in accessibility plugin |
| `TimestampPluginOptions` | Options for the timestamp plugin |
| `MetadataPluginOptions` | Options for the metadata plugin |
| `AccessibilityPluginOptions` | Options for the accessibility plugin |
