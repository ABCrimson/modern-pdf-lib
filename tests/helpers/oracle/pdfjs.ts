/**
 * pdf.js (pdfjs-dist, legacy build) as an outside oracle for the oracle project.
 *
 * withPdfjs() opens a copy of the bytes (getDocument transfers the buffer it is given) with
 * `useSystemFonts: false` and `verbosity: 0`, and destroys the loading task afterwards (in
 * pdfjs-dist 6.5 the document proxy has no destroy() of its own). pdfjsText() returns the text of each page: the
 * `str` of every text item joined by a space, whitespace runs collapsed to one space, trimmed.
 * pdfjsImages() returns, per page, each image XObject the page paints as pdf.js decodes it: in
 * Node pdf.js has no OffscreenCanvas, so it hands the decoded pixel data itself to the display
 * side, and a stream it cannot decode yields no data.
 */
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expect } from 'vitest';

/** The document proxy getDocument() resolves to. */
export type PdfjsDocument = Awaited<ReturnType<typeof getDocument>['promise']>;

export interface PdfjsOptions {
  readonly password?: string;
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Opens the bytes with pdf.js, runs `use` on the document and destroys the loading task. */
export async function withPdfjs<T>(
  bytes: Uint8Array,
  use: (doc: PdfjsDocument) => Promise<T>,
  options: PdfjsOptions = {},
): Promise<T> {
  const task = getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
    verbosity: 0,
    ...(options.password === undefined ? {} : { password: options.password }),
  });
  try {
    return await use(await task.promise);
  } finally {
    await task.destroy();
  }
}

/** The text of every page, as pdf.js extracts it (see the header). */
export function pdfjsText(bytes: Uint8Array, options: PdfjsOptions = {}): Promise<string[]> {
  return withPdfjs(
    bytes,
    async (doc) => {
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const content = await (await doc.getPage(n)).getTextContent();
        pages.push(
          collapse(content.items.map((item) => ('str' in item ? item.str : '')).join(' ')),
        );
      }
      return pages;
    },
    options,
  );
}

/** Asserts that pdf.js extracts exactly `expectedPerPage` (each collapsed as in pdfjsText()). */
export async function expectPdfjsText(
  bytes: Uint8Array,
  expectedPerPage: readonly string[],
  options: PdfjsOptions = {},
): Promise<void> {
  expect(await pdfjsText(bytes, options)).toEqual(expectedPerPage.map(collapse));
}

/** An image pdf.js decoded for a page: its size in pixels and its decoded pixel data. */
export interface PdfjsImage {
  readonly width: number;
  readonly height: number;
  /** Bytes of decoded pixel data pdf.js handed to the display side (0 when it sent none). */
  readonly dataLength: number;
}

/**
 * The images each page paints with an image XObject, as pdf.js decodes them (see the header):
 * the operator list names each one, and the page's object store resolves it to its pixels.
 */
export function pdfjsImages(
  bytes: Uint8Array,
  options: PdfjsOptions = {},
): Promise<PdfjsImage[][]> {
  return withPdfjs(
    bytes,
    async (doc) => {
      const pages: PdfjsImage[][] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const list = await page.getOperatorList();
        const images: PdfjsImage[] = [];
        for (const [i, fn] of list.fnArray.entries()) {
          if (fn !== OPS.paintImageXObject) continue;
          const id = (list.argsArray[i] as [string])[0];
          const image = await new Promise<{
            width: number;
            height: number;
            data?: ArrayLike<number>;
          }>((resolve, reject) => {
            page.objs.get(id, resolve, reject);
          });
          images.push({
            width: image.width,
            height: image.height,
            dataLength: image.data?.length ?? 0,
          });
        }
        pages.push(images);
      }
      return pages;
    },
    options,
  );
}
