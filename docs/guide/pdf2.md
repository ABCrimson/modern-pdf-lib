# PDF 2.0 Core (ISO 32000-2)

modern-pdf-lib implements the headline PDF 2.0 structures: associated files,
document parts, structure namespaces, processor requirements, per-page output
intents, encrypted-payload wrappers, soft-mask groups, image masks, and private
application data. The high-level pieces are on `PdfDocument`; the rest are
low-level builders that return PDF objects you register via
`doc.getRegistry()` / `page.registerExtGState()`.

## Feature index

| Feature | ISO 32000-2 | API |
|---|---|---|
| [Associated files](#associated-files) | §14.13 | `doc.addAssociatedFile`, `createAssociatedFile`, `attachAssociatedFiles` |
| [Document parts](#document-parts-dpart-hierarchy) | §14.12 | `buildDPartRoot` |
| [Per-page output intents](#per-page-per-stream-output-intents) | §14.11.5 | `buildPageOutputIntent`, `attachOutputIntents` |
| [Structure namespaces](#structure-namespaces-processor-requirements) | §14.7.4 | `buildNamespace`, `PDF2_NAMESPACE`, `MATHML_NAMESPACE` |
| [Processor requirements](#structure-namespaces-processor-requirements) | §7.12.7 | `buildRequirements` |
| [Encrypted-payload wrapper](#encrypted-payload-wrapper) | §7.6.7 | `buildUnencryptedWrapper`, `buildEncryptedPayload` |
| [Soft-mask groups](#soft-mask-groups-luminosity-alpha) | §11.6.5.2 | `buildSoftMaskGroupExtGState`, `buildSoftMaskNone` |
| [Image masks](#image-masks-black-point-compensation) | §8.9.6 | `buildStencilMask`, `buildColorKeyMask`, `buildImageSoftMask` |
| [Black-point compensation](#image-masks-black-point-compensation) | §8.6.5.9 | `buildBlackPointCompensationExtGState` |
| [Private application data](#private-application-data-pieceinfo) | §14.5 | `buildPieceInfo` |

> [!NOTE]
> These builders emit PDF 2.0 *structure*, but they do not change the file
> header. `save()` writes `%PDF-1.7` in every case except AES-256 encryption
> (V5/R6), where it writes `%PDF-2.0`. That matches how readers behave in
> practice — PDF 2.0 constructs are ignored rather than rejected by 1.7
> consumers — but if a downstream validator insists on a 2.0 header, encrypt
> with AES-256 or post-process the header yourself.

## Associated files

A PDF 2.0 **associated file** is an embedded file with a typed
`/AFRelationship` referenced from the catalog `/AF` array — so companion data
(an invoice XML, a source spreadsheet, …) travels *with* the document. This is
what PDF/A-3 and Factur-X/ZUGFeRD require:

```ts
import { createPdf } from 'modern-pdf-lib';

const doc = createPdf();
doc.addPage([595, 842]);

doc.addAssociatedFile(
  'factur-x.xml',
  xmlBytes,
  'text/xml',
  'Alternative', // Source | Data | Alternative | Supplement | EncryptedPayload | FormData | Schema | Unspecified
  { description: 'Factur-X invoice data' },
);

const bytes = await doc.save(); // catalog /AF + /Names/EmbeddedFiles written
```

For attaching `/AF` to **other** objects (a page, annotation, XObject, or
structure element), the low-level builders operate on any object dictionary:

```ts
import { createAssociatedFile, attachAssociatedFiles } from 'modern-pdf-lib';

const { fileSpecRef } = createAssociatedFile(doc.getRegistry(), {
  data, filename: 'data.xml', mimeType: 'text/xml', relationship: 'Data',
});
attachAssociatedFiles(someObjectDict, [fileSpecRef]); // sets/merges /AF on the dict
```

## Document parts (DPart hierarchy)

`/DPartRoot` + `/DPart` nodes group page ranges for variable-data / transactional
documents (ISO 32000-2 §14.12):

```ts
import { buildDPartRoot } from 'modern-pdf-lib';

const dpartRoot = buildDPartRoot([
  { startPage: 0, endPage: 1, metadata: { recipient: 'Acme Co.' } },
  { startPage: 2, endPage: 2, metadata: { recipient: 'Globex' } },
]);
const rootRef = doc.getRegistry().register(dpartRoot);
```

## Per-page / per-stream output intents

Doc-level output intents are part of PDF/A; PDF 2.0 also allows them per page and
per Form XObject (§14.11.5):

```ts
import { buildPageOutputIntent, attachOutputIntents } from 'modern-pdf-lib';

const intentRef = buildPageOutputIntent(doc.getRegistry(), {
  outputConditionIdentifier: 'sRGB IEC61966-2.1',
  subtype: '/GTS_PDFX',
});
attachOutputIntents(pageDict, [intentRef]); // page or Form-XObject stream dict
```

## Structure namespaces & processor requirements

```ts
import { buildNamespace, buildRequirements, PDF2_NAMESPACE, MATHML_NAMESPACE } from 'modern-pdf-lib';

const mathmlNs = buildNamespace({ ns: MATHML_NAMESPACE, roleMap: { mtable: 'Table' } });
const requirements = buildRequirements(['AcroForm', 'EnableJavaScripts']); // /Requirements array (§7.12.7)
```

## Encrypted-payload wrapper

A clear-text "wrapper" PDF whose body is an encrypted payload, for DRM /
secure-mail readers (§7.6.7):

```ts
import { buildUnencryptedWrapper, buildEncryptedPayload } from 'modern-pdf-lib';

const payloadRef = buildUnencryptedWrapper(doc.getRegistry(), {
  data: encryptedBytes, filename: 'payload.pdf', subtype: 'AESV3',
});
// payloadRef is a /Filespec with /AFRelationship /EncryptedPayload and an /EP dict;
// attach it to the catalog /AF (registerEmbeddedFile) to complete the wrapper.
```

## Soft-mask groups (luminosity / alpha)

An ExtGState `/SMask` masks subsequent drawing by the luminosity or alpha of a
transparency-group XObject — vector soft masks and fades (§11.6.5.2):

```ts
import { buildSoftMaskGroupExtGState, buildSoftMaskNone } from 'modern-pdf-lib';

const gs = buildSoftMaskGroupExtGState({
  groupXObject: maskGroupRef, // a Form XObject whose /Group is /S /Transparency
  type: 'Luminosity',
  backdropColor: [0, 0, 0],
});
page.registerExtGState('GS-Mask', doc.getRegistry().register(gs));
// later: clear it with buildSoftMaskNone() → /SMask /None
```

## Image masks & black-point compensation

Stencil masks, color-key masks, image soft masks (§8.9.6), and `/UseBlackPtComp`
(§8.6.5.9):

```ts
import {
  buildStencilMask, buildColorKeyMask, buildImageSoftMask, buildBlackPointCompensationExtGState,
} from 'modern-pdf-lib';

const r = doc.getRegistry();
const stencil = buildStencilMask(r, packedBits, 64, 64);     // 1-bpc /ImageMask image
const softMask = buildImageSoftMask(r, alphaGray, 64, 64);    // DeviceGray /SMask image
const colorKey = buildColorKeyMask([255, 255, 255, 255, 255, 255]); // /Mask color-key array
const bpc = buildBlackPointCompensationExtGState('ON');       // ExtGState /UseBlackPtComp /ON
```

## Private application data (PieceInfo)

`/PieceInfo` carries round-trippable private data keyed by application (§14.5):

```ts
import { buildPieceInfo, PdfDict, PdfString } from 'modern-pdf-lib';

const data = new PdfDict();
data.set('/LayoutVersion', PdfString.literal('2.1'));
const pieceInfo = buildPieceInfo('MyApp', data, new Date());
const ref = doc.getRegistry().register(pieceInfo);
```
