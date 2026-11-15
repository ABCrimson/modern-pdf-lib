/**
 * Entries of the structure-limits adversarial test: each builds its input in code (small object
 * graphs and one short path string) and returns a count the test asserts. The runner loads this
 * module in a worker (tests/helpers/budget.ts).
 */
import { PdfArray, PdfDict, PdfName, PdfRef, PdfString } from '../../src/core/pdfObjects.js';
import type { PdfObject } from '../../src/core/pdfObjects.js';
import { PdfOutlineTree } from '../../src/outline/pdfOutline.js';
import { PdfStructureTree } from '../../src/accessibility/structureTree.js';
import { GrowableBuffer } from '../../src/compliance/internal/binary.js';
import { parseSvgPath } from '../../src/assets/svg/svgParser.js';
import type { JsonValue } from '../helpers/budget.js';

/** An outline item with a title and optional /First and /Next links. */
function item(first?: number, next?: number): PdfDict {
  const dict = new PdfDict();
  dict.set('/Title', PdfString.literal('item'));
  if (first !== undefined) dict.set('/First', PdfRef.of(first));
  if (next !== undefined) dict.set('/Next', PdfRef.of(next));
  return dict;
}

/** Reads the outline whose root /First is object 1 from `objects`; returns the item count by level. */
function readOutline(objects: Map<number, PdfObject>): JsonValue {
  const root = new PdfDict();
  root.set('/First', PdfRef.of(1));
  const tree = PdfOutlineTree.fromDict(
    root,
    (ref) => objects.get(ref.objectNumber),
    new Map<number, number>(),
  );
  const levels: number[] = [];
  let level = tree.items;
  while (level.length > 0) {
    levels.push(level.length);
    level = level.flatMap((entry) => [...entry.children]);
  }
  return levels;
}

/** Two items whose /Next point at each other: the walk reads both once. */
export function outlineNextLoop(): JsonValue {
  return readOutline(
    new Map<number, PdfObject>([
      [1, item(undefined, 2)],
      [2, item(undefined, 1)],
    ]),
  );
}

/** One item whose /First is itself: the walk reads it once. */
export function outlineFirstLoop(): JsonValue {
  return readOutline(new Map<number, PdfObject>([[1, item(1)]]));
}

/** A chain of `args` items, each the first child of the one before: throws above 256 levels. */
export function outlineChain(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const levels = args as number;
  const objects = new Map<number, PdfObject>();
  for (let n = 1; n <= levels; n++) objects.set(n, item(n < levels ? n + 1 : undefined));
  return readOutline(objects);
}

/** An element dict with /S /P and a /K of the given objects. */
function element(...kids: number[]): PdfDict {
  const dict = new PdfDict();
  dict.set('/S', PdfName.of('P'));
  if (kids.length > 0) dict.set('/K', PdfArray.of(kids.map((n) => PdfRef.of(n))));
  return dict;
}

/** Reads the structure tree whose root /K is the element object 1; returns the elements by level. */
function readStructure(objects: Map<number, PdfObject>): JsonValue {
  const root = new PdfDict();
  root.set('/K', PdfRef.of(1));
  const tree = PdfStructureTree.fromDict(root, (ref) => objects.get(ref.objectNumber));
  const levels: number[] = [];
  let level = [...tree.root.children];
  while (level.length > 0) {
    levels.push(level.length);
    level = level.flatMap((entry) => [...entry.children]);
  }
  return levels;
}

/** An element whose /K is itself: it is read once. */
export function structureSelfLoop(): JsonValue {
  return readStructure(new Map<number, PdfObject>([[1, element(1)]]));
}

/** Two elements that name each other in /K: each is read once. */
export function structureMutualLoop(): JsonValue {
  return readStructure(
    new Map<number, PdfObject>([
      [1, element(2)],
      [2, element(1)],
    ]),
  );
}

/** A chain of `args` elements, each the only kid of the one before: throws above 256 levels. */
export function structureChain(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const levels = args as number;
  const objects = new Map<number, PdfObject>();
  for (let n = 1; n <= levels; n++) objects.set(n, n < levels ? element(n + 1) : element());
  return readStructure(objects);
}

/** A non-finite initial capacity: throws RangeError. */
export function growableNonFinite(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const capacity = args === 'NaN' ? Number.NaN : args === 'Infinity' ? Infinity : -Infinity;
  const buffer = new GrowableBuffer(capacity);
  buffer.write(new Uint8Array([1]));
  return buffer.length;
}

/** Path data with a number after a closepath: returns the command types before it. */
export function svgNumberAfterClose(): JsonValue {
  return parseSvgPath('M0 0 L1 1 Z 5').map((command) => command.type);
}
