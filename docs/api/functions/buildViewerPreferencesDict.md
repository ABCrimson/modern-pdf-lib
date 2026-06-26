[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildViewerPreferencesDict

# Function: buildViewerPreferencesDict()

```ts
function buildViewerPreferencesDict(prefs): PdfDict;
```

Defined in: [src/metadata/viewerPreferences.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/metadata/viewerPreferences.ts#L88)

Build a `/ViewerPreferences` dictionary from preferences.

Only includes entries for properties that are explicitly set
(non-undefined).  Boolean values of `false` are included to
explicitly override viewer defaults.

## Parameters

### prefs

[`ViewerPreferences`](../interfaces/ViewerPreferences.md)

Viewer preferences to serialize.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A PdfDict representing the `/ViewerPreferences` entry.
