/**
 * G-HEADROOM: every file under tests/fixtures goes through the decode paths the limits
 * guard, and the largest value of each limited quantity stays at or below a quarter of its field
 * in INTERNAL_LIMITS (src/internal/limits.ts).
 *
 * Why it exists: the corpus gate (tests/oracle/corpus.test.ts) loads files and extracts text but
 * decodes no image, parses no font and interprets no Form XObject, so it cannot show that a limit
 * leaves room for ordinary input. For each PDF this file:
 *   - loads it (with its password) and decodes every stream one filter at a time;
 *   - parses every ToUnicode CMap and every embedded TrueType program, and reads every embedded
 *     font program's decoded length;
 *   - reads each page's text, extracts its images, and interprets it (Form XObjects included);
 *   - reads the outline tree and the structure tree through their public `fromDict`;
 *   - verifies signatures and measures the DER nesting of each signature's /Contents.
 * Each PNG and JPEG under tests/fixtures goes through its embed entry point, and any font, TIFF
 * or WebP file there through its decoder (the tree holds none today: the walk covers them when
 * one is added).
 *
 * Two assertions: (1) no step throws ResourceLimitError; (2) each measured maximum is at most the
 * limit divided by HEADROOM (4). A step that throws anything else (a damaged file, a
 * known load defect, UnsupportedFilterError for JPX and JBIG2) is counted and printed, never
 * silent; the sanity test fails when too few steps measured anything. One table line per
 * quantity is printed: measured maximum, limit, ratio and the file that holds the maximum.
 *
 * Measured through public or module-level entry points only: decoded lengths come from this
 * file's own decode calls, the CMap count from the CMap text (bfchar pairs plus range spans,
 * which is what parseToUnicodeCMap counts), the font cmap size from the parsed map (see
 * FONT_CMAP below), the form operator cost from a walk that mirrors the interpreter's weighted rule (operatorCost
 * below), the predictor sample count from the sub-byte /Predictor 2 geometry of each stream.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, test } from 'vitest';
import {
  extractMetrics,
  extractPageImages,
  extractText,
  interpretPage,
  loadPdf,
  parseContentStream,
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfOutlineTree,
  PdfStream,
  PdfStructureTree,
  ResourceLimitError,
  UnsupportedFilterError,
  verifySignatures,
} from '../../src/index.js';
import type { PdfDocument, PdfObject, PdfObjectRegistry, PdfRef } from '../../src/index.js';
import { INTERNAL_LIMITS } from '../../src/internal/limits.js';
import type { ResourceLimitName } from '../../src/internal/limits.js';
import { decodeWoff, isWoff } from '../../src/assets/font/woff.js';
import { decodeStream, getStreamFilters } from '../../src/codecs/streamDecode.js';
import { parseToUnicodeCMap } from '../../src/parser/text/textExtractor.js';
import { embedPng } from '../../src/assets/image/internal/pngEmbed.js';
import { embedJpeg } from '../../src/assets/image/jpeg/jpegEmbed.js';
import { decodeWebP, isWebP } from '../../src/assets/image/webp/webpDecode.js';
import { getTiffPageCount, isTiff } from '../../src/assets/image/tiff/tiffDecode.js';
import { parseDerTlv } from '../../src/signature/cms/pkcs7.js';
import type { Asn1Node } from '../../src/signature/cms/pkcs7.js';

/** The factor between a measured maximum and its limit. */
const HEADROOM = 4;

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

/** The interpreter's Form XObject nesting depth (MAX_FORM_DEPTH in src/render/interpreter.ts). */
const FORM_DEPTH = 12;

/**
 * Files that do not load, with the reason the corpus test records for them (KNOWN in
 * tests/oracle/corpus.test.ts). No file is expected to fail to load now, so the map is empty; it
 * stays for a later defect. A file listed here that loads is measured like any other; a file
 * that fails to load and is not listed fails this test.
 */
const LOAD_DEFECTS: ReadonlyMap<string, string> = new Map([]);

/**
 * The font cmap quantity is the size of the parsed map, a lower bound of what
 * maxFontCmapMappings counts (it counts the codes a subtable names, before glyph ids at or above
 * numGlyphs are dropped). The count itself is private to src/assets/font/fontMetrics.ts.
 */
const FONT_CMAP = 'size of the parsed cmap map';

interface Quantity {
  readonly id: string;
  readonly limit: ResourceLimitName;
  readonly label: string;
}

const QUANTITIES: readonly Quantity[] = [
  { id: 'decoded', limit: 'maxDecodedStreamBytes', label: 'decoded stream bytes per filter' },
  { id: 'cmap', limit: 'maxCMapMappings', label: 'ToUnicode mappings' },
  { id: 'fontCmap', limit: 'maxFontCmapMappings', label: `font cmap codes (${FONT_CMAP})` },
  { id: 'der', limit: 'maxDerDepth', label: 'DER depth' },
  { id: 'outline', limit: 'maxTreeDepth', label: 'outline depth' },
  { id: 'structure', limit: 'maxTreeDepth', label: 'structure depth' },
  { id: 'formOps', limit: 'maxFormOperators', label: 'weighted operators inside forms per page' },
  { id: 'predictor', limit: 'maxPredictorSamples', label: 'sub-byte TIFF predictor samples' },
  { id: 'width', limit: 'maxImageDimension', label: 'image width (CCITT /Columns included)' },
  { id: 'height', limit: 'maxImageDimension', label: 'image height (CCITT /Rows included)' },
  { id: 'pixels', limit: 'maxImagePixels', label: 'image pixels' },
  { id: 'imageBytes', limit: 'maxImageBytes', label: 'image sample bytes' },
  { id: 'frames', limit: 'maxImageFrames', label: 'TIFF frames' },
  { id: 'fontBytes', limit: 'maxFontBytes', label: 'font program bytes' },
];

interface Best {
  value: number;
  file: string;
}

const maxima = new Map<string, Best>(QUANTITIES.map((q) => [q.id, { value: 0, file: '-' }]));
/** Every ResourceLimitError a step threw: file, step, message. */
const limitErrors: string[] = [];
/** Steps that threw something else, by step and error name: the count and the files. */
const otherErrors = new Map<string, { n: number; files: Set<string> }>();
/** Files skipped, with the reason. */
const skipped: string[] = [];
const counts = { pdfs: 0, loaded: 0, pages: 0, streams: 0, decodes: 0, unsupported: 0, steps: 0 };

function note(id: string, value: number, file: string): void {
  const best = maxima.get(id);
  if (best !== undefined && Number.isFinite(value) && value > best.value) {
    best.value = value;
    best.file = file;
  }
}

/** Records a step's failure: a limit error is kept, UnsupportedFilterError is counted, the rest is tallied. */
function record(error: unknown, file: string, name: string): void {
  if (error instanceof ResourceLimitError) {
    limitErrors.push(`${file} ${name}: ${error.message}`);
  } else if (error instanceof UnsupportedFilterError) {
    counts.unsupported++;
  } else {
    const key = `${name}: ${error instanceof Error ? error.name : typeof error}`;
    const entry = otherErrors.get(key) ?? { n: 0, files: new Set<string>() };
    entry.n++;
    entry.files.add(file);
    otherErrors.set(key, entry);
  }
}

/** Runs one step; returns undefined when it fails (see record). */
function step<T>(file: string, name: string, run: () => T): T | undefined {
  counts.steps++;
  try {
    return run();
  } catch (error) {
    record(error, file, name);
    return undefined;
  }
}

async function stepAsync<T>(
  file: string,
  name: string,
  run: () => Promise<T>,
): Promise<T | undefined> {
  counts.steps++;
  try {
    return await run();
  } catch (error) {
    record(error, file, name);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// The files and their passwords
// ---------------------------------------------------------------------------

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out.sort();
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Passwords by path relative to tests/fixtures, from the manifests that record them. */
function passwords(): Map<string, string> {
  const map = new Map<string, string>();
  const corpus = readJson(join(FIXTURES, 'corpus/manifest.json')) as {
    file: string;
    password: string | null;
  }[];
  for (const e of corpus) if (e.password !== null) map.set(`corpus/${e.file}`, e.password);
  // Its three lists carry paths relative to encrypted/ (`extra/...`, `load/...`). An entry's own
  // user password, when it differs from the shared one, is listed as code points
  // (`U+FB01 U+0078 ...`, or empty for the empty password), as tests/oracle/aes.test.ts reads it.
  interface EncryptedEntry {
    file: string;
    userPasswordCodePoints?: string;
    encryption?: unknown;
  }
  const encrypted = readJson(join(FIXTURES, 'encrypted/manifest.json')) as {
    userPassword: string;
    files: EncryptedEntry[];
    extra: EncryptedEntry[];
    load: EncryptedEntry[];
  };
  for (const e of [...encrypted.files, ...encrypted.extra, ...encrypted.load]) {
    if (e.encryption === undefined) continue;
    const points = e.userPasswordCodePoints;
    const password =
      points === undefined
        ? encrypted.userPassword
        : points === ''
          ? ''
          : String.fromCodePoint(...points.split(' ').map((u) => Number.parseInt(u.slice(2), 16)));
    map.set(`encrypted/${e.file}`, password);
  }
  // Every legacy-<version>/ directory: its manifest records each encrypted file's user password.
  const legacyDirs = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('legacy-'))
    .map((d) => d.name)
    .sort();
  for (const dir of legacyDirs) {
    const legacy = readJson(join(FIXTURES, dir, 'manifest.json')) as {
      file: string;
      expect: { encryption?: { userPassword: string } };
    }[];
    for (const e of legacy) {
      if (e.expect.encryption !== undefined) {
        map.set(`${dir}/${e.file}`, e.expect.encryption.userPassword);
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Measuring
// ---------------------------------------------------------------------------

function nameOf(object: PdfObject | undefined): string | undefined {
  return object instanceof PdfName ? object.value : undefined;
}

function numberOf(object: PdfObject | undefined): number | undefined {
  return object instanceof PdfNumber ? object.value : undefined;
}

function isRef(object: PdfObject | undefined): object is PdfRef {
  return object?.kind === 'ref';
}

/** Components per pixel of an image's colour space, resolved far enough for a size estimate. */
function components(
  dict: PdfDict,
  resolve: (o: PdfObject | undefined) => PdfObject | undefined,
): number {
  if (resolve(dict.get('/ImageMask'))?.kind === 'bool') return 1;
  const cs = resolve(dict.get('/ColorSpace'));
  const byName = (n: string | undefined): number => {
    if (n === '/DeviceRGB' || n === '/RGB' || n === '/CalRGB' || n === '/Lab') return 3;
    if (n === '/DeviceCMYK' || n === '/CMYK') return 4;
    return 1;
  };
  if (cs instanceof PdfName) return byName(cs.value);
  if (cs instanceof PdfArray) {
    const head = nameOf(resolve(cs.items[0]));
    if (head === '/ICCBased') {
      const profile = resolve(cs.items[1]);
      return profile instanceof PdfStream ? (numberOf(resolve(profile.dict.get('/N'))) ?? 3) : 3;
    }
    return byName(head);
  }
  return 1;
}

/** The deepest nesting of constructed values below (and including) a node. */
function derDepth(node: Asn1Node): number {
  if (!node.constructed) return 0;
  let deepest = 0;
  for (const child of node.children) deepest = Math.max(deepest, derDepth(child));
  return deepest + 1;
}

/** Deepest level of an outline or structure tree: roots are level 1. */
function treeDepth(items: readonly { children: readonly unknown[] }[], level = 1): number {
  let deepest = items.length > 0 ? level : level - 1;
  for (const item of items) {
    deepest = Math.max(
      deepest,
      treeDepth(item.children as readonly { children: readonly unknown[] }[], level + 1),
    );
  }
  return deepest;
}

/** The codes a ToUnicode CMap names: bfchar pairs plus bfrange spans (what the parser counts). */
function cmapMappings(text: string): number {
  let count = 0;
  for (const section of text.matchAll(/beginbfchar\s*([\s\S]*?)\s*endbfchar/g)) {
    count += [...section[1]!.matchAll(/<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>/g)].length;
  }
  for (const section of text.matchAll(/beginbfrange\s*([\s\S]*?)\s*endbfrange/g)) {
    for (const m of section[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      count += Math.max(0, parseInt(m[2]!, 16) - parseInt(m[1]!, 16) + 1);
    }
  }
  return count;
}

type Ops = ReturnType<typeof parseContentStream>;

/** What an operand adds to its operator's cost: string length, or elements plus theirs (recursive). */
function operandCost(operand: Ops[number]['operands'][number]): number {
  if (typeof operand === 'string') return operand.length;
  if (Array.isArray(operand)) {
    let cost = operand.length;
    for (const element of operand) cost += operandCost(element);
    return cost;
  }
  return 0;
}

/**
 * What one operator counts toward maxFormOperators (the rule parseContentStreamCounted in
 * src/parser/contentStreamParser.ts applies): one, plus one per operand beyond six, plus each
 * operand's cost. Operands after a form's last operator, which that rule also counts, are not measured here.
 */
function operatorCost(operator: Ops[number]): number {
  let cost = 1 + Math.max(0, operator.operands.length - 6);
  for (const operand of operator.operands) cost += operandCost(operand);
  return cost;
}

/**
 * The weighted operator cost the interpreter charges inside Form XObjects for one page: every `Do`
 * of a form adds that form's cost (operatorCost summed over its operators), a form already being
 * interpreted is not entered, and the nesting stops at FORM_DEPTH (mirrors doXObject in
 * src/render/interpreter.ts).
 */
function formOperators(
  ops: Ops,
  resources: PdfDict | undefined,
  resolve: (o: PdfObject | undefined) => PdfObject | undefined,
  decode: (s: PdfStream) => Uint8Array,
): number {
  const parsed = new Map<PdfStream, Ops>();
  const active = new Set<PdfStream>();
  let total = 0;
  const visit = (list: Ops, res: PdfDict | undefined, depth: number): void => {
    for (const op of list) {
      if (op.operator !== 'Do' || depth >= FORM_DEPTH || total > 100_000_000) continue;
      const operand = op.operands[0];
      const key = operand instanceof PdfName ? operand.value : undefined;
      const xobjects = resolve(res?.get('/XObject'));
      if (key === undefined || !(xobjects instanceof PdfDict)) continue;
      const form = resolve(xobjects.get(key));
      if (!(form instanceof PdfStream) || nameOf(resolve(form.dict.get('/Subtype'))) !== '/Form') {
        continue;
      }
      if (active.has(form)) continue;
      active.add(form);
      let formOps = parsed.get(form);
      if (formOps === undefined) {
        formOps = parseContentStream(decode(form));
        parsed.set(form, formOps);
      }
      for (const formOp of formOps) total += operatorCost(formOp);
      const own = resolve(form.dict.get('/Resources'));
      visit(formOps, own instanceof PdfDict ? own : res, depth + 1);
      active.delete(form);
    }
  };
  visit(ops, resources, 0);
  return total;
}

async function measurePdf(path: string, id: string, password: string | undefined): Promise<void> {
  counts.pdfs++;
  const bytes = new Uint8Array(readFileSync(path));
  let doc: PdfDocument;
  try {
    doc = await loadPdf(bytes, password === undefined ? {} : { password });
  } catch (error) {
    if (error instanceof ResourceLimitError) {
      limitErrors.push(`${id} load: ${error.message}`);
      return;
    }
    const reason = LOAD_DEFECTS.get(id);
    if (reason === undefined) throw error;
    skipped.push(`${id}: does not load, ${reason}: ${(error as Error).message.slice(0, 80)}`);
    return;
  }
  counts.loaded++;
  const registry: PdfObjectRegistry = doc.getRegistry();
  const resolve = (o: PdfObject | undefined): PdfObject | undefined =>
    isRef(o) ? registry.resolve(o) : o;
  const decode = (s: PdfStream): Uint8Array => {
    const { filters, decodeParms } = getStreamFilters(s.dict);
    return filters.length === 0 ? s.data : decodeStream(s.data, filters, decodeParms as PdfDict[]);
  };

  for (const { object } of registry) {
    if (!(object instanceof PdfStream) && !(object instanceof PdfDict)) continue;
    const dict = object instanceof PdfStream ? object.dict : object;

    // Image dictionaries: sizes as declared, plus the sample bytes they imply.
    if (object instanceof PdfStream && nameOf(resolve(dict.get('/Subtype'))) === '/Image') {
      const w = numberOf(resolve(dict.get('/Width'))) ?? 0;
      const h = numberOf(resolve(dict.get('/Height'))) ?? 0;
      const bpc = numberOf(resolve(dict.get('/BitsPerComponent'))) ?? 8;
      note('width', w, id);
      note('height', h, id);
      note('pixels', w * h, id);
      note('imageBytes', h * Math.ceil((w * components(dict, resolve) * bpc) / 8), id);
    }

    // Font programs: decoded length, and the parsed cmap of a TrueType program.
    for (const key of ['/FontFile', '/FontFile2', '/FontFile3']) {
      const program = resolve(dict.get(key));
      if (!(program instanceof PdfStream)) continue;
      const decoded = step(id, 'font program decode', () => decode(program));
      if (decoded === undefined) continue;
      note('fontBytes', decoded.length, id);
      if (key === '/FontFile2') {
        const metrics = step(id, 'font metrics', () => extractMetrics(decoded));
        if (metrics !== undefined) note('fontCmap', metrics.cmapTable.size, id);
      }
    }

    if (!(object instanceof PdfStream)) continue;
    counts.streams++;
    const { filters, decodeParms } = getStreamFilters(object.dict);
    if (filters.length === 0) continue;

    // CCITT /Columns and /Rows count as image dimensions.
    decodeParms.forEach((p, i) => {
      if (filters[i] !== 'CCITTFaxDecode' || p === null) return;
      note('width', numberOf(resolve(p.get('/Columns'))) ?? 1728, id);
      note('height', numberOf(resolve(p.get('/Rows'))) ?? 0, id);
    });

    // One filter at a time, so each filter's own output is measured.
    let data = object.data;
    let decoded: Uint8Array | undefined;
    for (let i = 0; i < filters.length; i++) {
      const next = step(id, `decode ${filters[i]}`, () =>
        decodeStream(data, [filters[i]!], [decodeParms[i] ?? null] as PdfDict[]),
      );
      if (next === undefined) {
        decoded = undefined;
        break;
      }
      counts.decodes++;
      note('decoded', next.length, id);
      // Sub-byte /Predictor 2 visits every sample (rows * columns * colors): see applyTiffPredictor2.
      const parms = decodeParms[i];
      if ((filters[i] === 'FlateDecode' || filters[i] === 'LZWDecode') && parms) {
        const predictor = numberOf(resolve(parms.get('/Predictor'))) ?? 1;
        const bpc = numberOf(resolve(parms.get('/BitsPerComponent'))) ?? 8;
        if (predictor === 2 && (bpc === 1 || bpc === 2 || bpc === 4)) {
          const columns = numberOf(resolve(parms.get('/Columns'))) ?? 1;
          const colors = numberOf(resolve(parms.get('/Colors'))) ?? 1;
          const rowBytes = Math.ceil((columns * colors * bpc) / 8);
          note('predictor', Math.floor(next.length / rowBytes) * columns * colors, id);
        }
      }
      data = next;
      decoded = next;
    }
    if (decoded === undefined) continue;

    // A ToUnicode CMap is recognised by its sections, as the calibration did.
    const head = new TextDecoder('latin1').decode(
      decoded.subarray(0, Math.min(decoded.length, 1 << 22)),
    );
    if (head.includes('beginbfrange') || head.includes('beginbfchar')) {
      note('cmap', cmapMappings(head), id);
      step(id, 'ToUnicode parse', () => parseToUnicodeCMap(decoded));
    }
  }

  const pages = doc.getPageCount();
  counts.pages += pages;
  for (let i = 0; i < pages; i++) {
    const page = doc.getPage(i);
    const resources = page.getOriginalResources();
    const ops = step(id, 'page content parse', () => parseContentStream(page.getContentStream()));
    if (ops !== undefined) {
      step(id, 'text extraction', () => extractText(ops, resources));
      note(
        'formOps',
        step(id, 'form operator walk', () => formOperators(ops, resources, resolve, decode)) ?? 0,
        id,
      );
    }
    for (const image of step(id, 'image extraction', () => extractPageImages(page)) ?? []) {
      note('imageBytes', image.pixels.length, id);
      note('pixels', image.width * image.height, id);
    }
    step(id, 'page interpretation', () => interpretPage(page));
  }

  // The catalog's outline and structure roots, read through the public fromDict.
  let catalog: PdfDict | undefined;
  for (const { object } of registry) {
    if (object instanceof PdfDict && nameOf(resolve(object.get('/Type'))) === '/Catalog') {
      catalog = object;
      break;
    }
  }
  const outlines = resolve(catalog?.get('/Outlines'));
  if (outlines instanceof PdfDict) {
    const tree = step(id, 'outline read', () =>
      PdfOutlineTree.fromDict(outlines, (r) => registry.resolve(r), new Map()),
    );
    if (tree !== undefined) note('outline', treeDepth(tree.items), id);
  }
  const structRoot = resolve(catalog?.get('/StructTreeRoot'));
  if (structRoot instanceof PdfDict) {
    const tree = step(id, 'structure tree read', () =>
      PdfStructureTree.fromDict(structRoot, (r) => registry.resolve(r)),
    );
    if (tree !== undefined) note('structure', treeDepth(tree.root.children), id);
  }

  // Signatures: verification must not throw, and each /Contents is measured for DER depth.
  const text = new TextDecoder('latin1').decode(bytes);
  if (/\/ByteRange/.test(text)) {
    for (const m of text.matchAll(/\/Contents\s*<([0-9a-fA-F\s]*)>/g)) {
      const hex = m[1]!.replace(/\s/g, '');
      if (hex.length < 8) continue;
      const der = Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
      const node = step(id, 'DER parse', () => parseDerTlv(der, 0));
      if (node !== undefined) note('der', derDepth(node), id);
    }
    await stepAsync(id, 'signature verification', () => verifySignatures(bytes));
  }
}

function measureImageFile(path: string, id: string): void {
  const data = new Uint8Array(readFileSync(path));
  const ext = extname(path).toLowerCase();
  if (ext === '.png') {
    const r = step(id, 'PNG embed', () => embedPng(data));
    if (r === undefined) return;
    note('width', r.width, id);
    note('height', r.height, id);
    note('pixels', r.width * r.height, id);
    note('imageBytes', r.height * Math.ceil((r.width * 4 * r.bitsPerComponent) / 8), id);
  } else if (ext === '.jpg' || ext === '.jpeg') {
    const r = step(id, 'JPEG embed', () => embedJpeg(data));
    if (r === undefined) return;
    note('width', r.width, id);
    note('height', r.height, id);
    note('pixels', r.width * r.height, id);
    note('imageBytes', r.width * r.height * r.componentCount, id);
  } else if (ext === '.webp' && isWebP(data)) {
    const r = step(id, 'WebP decode', () => decodeWebP(data));
    if (r === undefined) return;
    note('width', r.width, id);
    note('height', r.height, id);
    note('pixels', r.width * r.height, id);
    note('imageBytes', r.width * r.height * 4, id);
  } else if ((ext === '.tif' || ext === '.tiff') && isTiff(data)) {
    const frames = step(id, 'TIFF page count', () => getTiffPageCount(data));
    if (frames !== undefined) note('frames', frames, id);
  }
}

function measureFontFile(path: string, id: string): void {
  let data: Uint8Array = new Uint8Array(readFileSync(path));
  if (isWoff(data)) {
    const sfnt = step(id, 'WOFF decode', () => decodeWoff(data));
    if (sfnt === undefined) return;
    data = sfnt;
  }
  note('fontBytes', data.length, id);
  const metrics = step(id, 'font metrics', () => extractMetrics(data));
  if (metrics !== undefined) note('fontCmap', metrics.cmapTable.size, id);
}

// ---------------------------------------------------------------------------
// The tests
// ---------------------------------------------------------------------------

const files = walk(FIXTURES);
const pw = passwords();
const rel = (p: string): string => relative(FIXTURES, p).replaceAll('\\', '/');
const pdfs = files.filter((f) => extname(f).toLowerCase() === '.pdf');
const imageFiles = files.filter((f) =>
  ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(extname(f).toLowerCase()),
);
const fontFiles = files.filter((f) =>
  ['.ttf', '.otf', '.woff', '.woff2'].includes(extname(f).toLowerCase()),
);

describe('limits headroom over tests/fixtures', () => {
  afterAll(() => {
    const lines = QUANTITIES.map((q) => {
      const best = maxima.get(q.id)!;
      const limit = INTERNAL_LIMITS[q.limit];
      return `${q.label.padEnd(46)} max ${String(best.value).padStart(10)}  limit ${String(limit).padStart(10)}  ratio ${(best.value / limit).toExponential(2)}  (${best.file})`;
    });
    const summary = `${counts.pdfs} PDFs (${counts.loaded} loaded, ${counts.pages} pages, ${counts.streams} streams, ${counts.decodes} filter outputs), ${imageFiles.length} image files, ${fontFiles.length} font files, ${counts.steps} steps, ${counts.unsupported} UnsupportedFilterError`;
    const others =
      [...otherErrors]
        .map(
          ([k, e]) =>
            `${k} x${e.n} in ${e.files.size} files (${[...e.files].slice(0, 6).join(', ')})`,
        )
        .join('; ') || 'none';
    process.stdout.write(
      [
        '',
        'limits headroom (ceiling / 4):',
        summary,
        ...lines,
        `other step errors: ${others}`,
        ...skipped.map((s) => `skipped ${s}`),
      ].join('\n'),
    );
  });

  describe.each(pdfs.map((p) => [rel(p), p] as const))('%s', (id, path) => {
    test('decodes within the limits', async () => {
      await measurePdf(path, id, pw.get(id));
    }, 60_000);
  });

  describe.each(imageFiles.map((p) => [rel(p), p] as const))('%s', (id, path) => {
    test('decodes within the limits', () => {
      measureImageFile(path, id);
    });
  });

  describe.each(fontFiles.map((p) => [rel(p), p] as const))('%s', (id, path) => {
    test('parses within the limits', () => {
      measureFontFile(path, id);
    });
  });

  test('no step threw ResourceLimitError', () => {
    expect(limitErrors).toEqual([]);
  });

  test('the walk measured something', () => {
    // A walk whose steps all failed would pass the two checks below for nothing.
    expect(counts.loaded).toBeGreaterThanOrEqual(pdfs.length - LOAD_DEFECTS.size);
    expect(counts.pages).toBeGreaterThan(0);
    expect(counts.decodes).toBeGreaterThan(0);
    for (const id of [
      'decoded',
      'cmap',
      'fontCmap',
      'der',
      'outline',
      'structure',
      'formOps',
      'width',
      'height',
      'pixels',
      'imageBytes',
      'fontBytes',
    ]) {
      expect(maxima.get(id)!.value, `${id} was never measured`).toBeGreaterThan(0);
    }
  });

  test.each(QUANTITIES.map((q) => [q.label, q] as const))(
    '%s is at most 1/4 of its limit',
    (_label, q) => {
      const best = maxima.get(q.id)!;
      expect(best.value, `${q.label}: ${best.value} in ${best.file}`).toBeLessThanOrEqual(
        INTERNAL_LIMITS[q.limit] / HEADROOM,
      );
    },
  );
});
