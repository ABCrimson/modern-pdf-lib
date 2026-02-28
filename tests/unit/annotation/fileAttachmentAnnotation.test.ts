/**
 * Tests for PdfFileAttachmentAnnotation.
 */

import { describe, it, expect } from 'vitest';
import { PdfFileAttachmentAnnotation } from '../../../src/annotation/types/fileAttachmentAnnotation.js';
import {
  PdfDict,
  PdfName,
  PdfString,
  PdfArray,
  PdfNumber,
  PdfRef,
} from '../../../src/core/pdfObjects.js';
import type { PdfObject, PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Mock registry for buildFileSpec
// ---------------------------------------------------------------------------

function createMockRegistry(): PdfObjectRegistry {
  let nextId = 100;
  return {
    register(obj: PdfObject): PdfRef {
      return PdfRef.of(nextId++, 0);
    },
    resolve(ref: PdfRef): PdfObject | undefined {
      return undefined;
    },
  } as PdfObjectRegistry;
}

describe('PdfFileAttachmentAnnotation', () => {
  describe('create', () => {
    it('creates a file attachment annotation with required options', () => {
      const fileData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const annot = PdfFileAttachmentAnnotation.create({
        rect: [100, 700, 120, 720],
        file: fileData,
        fileName: 'hello.txt',
      });

      expect(annot.getType()).toBe('FileAttachment');
      expect(annot.getRect()).toEqual([100, 700, 120, 720]);
      expect(annot.getIcon()).toBe('GraphPushPin'); // default
    });

    it('creates with custom icon', () => {
      const annot = PdfFileAttachmentAnnotation.create({
        rect: [0, 0, 20, 20],
        file: new Uint8Array([1, 2, 3]),
        fileName: 'data.bin',
        icon: 'Paperclip',
      });

      expect(annot.getIcon()).toBe('Paperclip');
    });

    it('creates with all icon types', () => {
      const icons = ['GraphPushPin', 'PaperclipTag', 'Paperclip', 'Tag'] as const;
      for (const icon of icons) {
        const annot = PdfFileAttachmentAnnotation.create({
          rect: [0, 0, 20, 20],
          file: new Uint8Array([1]),
          fileName: 'test.bin',
          icon,
        });
        expect(annot.getIcon()).toBe(icon);
      }
    });

    it('creates with MIME type and description', () => {
      const annot = PdfFileAttachmentAnnotation.create({
        rect: [0, 0, 20, 20],
        file: new Uint8Array([0x3C, 0x3F, 0x78, 0x6D, 0x6C]),
        fileName: 'invoice.xml',
        mimeType: 'application/xml',
        description: 'Invoice XML data',
      });

      expect(annot.getType()).toBe('FileAttachment');
    });
  });

  describe('fromDict', () => {
    it('parses a file attachment dictionary', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FileAttachment'));
      dict.set('/Rect', PdfArray.fromNumbers([50, 600, 70, 620]));
      dict.set('/Name', PdfName.of('Tag'));

      const annot = PdfFileAttachmentAnnotation.fromDict(dict);
      expect(annot.getType()).toBe('FileAttachment');
      expect(annot.getIcon()).toBe('Tag');
    });

    it('defaults icon to GraphPushPin when /Name absent', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FileAttachment'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));

      const annot = PdfFileAttachmentAnnotation.fromDict(dict);
      expect(annot.getIcon()).toBe('GraphPushPin');
    });

    it('reads filename from /FS dict', () => {
      const fsDict = new PdfDict();
      fsDict.set('/Type', PdfName.of('Filespec'));
      fsDict.set('/UF', PdfString.literal('report.pdf'));
      fsDict.set('/F', PdfString.literal('report.pdf'));

      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FileAttachment'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));
      dict.set('/FS', fsDict);

      const annot = PdfFileAttachmentAnnotation.fromDict(dict);
      expect(annot.getFileName()).toBe('report.pdf');
    });
  });

  describe('setters', () => {
    it('setIcon changes the icon', () => {
      const annot = PdfFileAttachmentAnnotation.create({
        rect: [0, 0, 20, 20],
        file: new Uint8Array([1]),
        fileName: 'test.bin',
      });

      annot.setIcon('Tag');
      expect(annot.getIcon()).toBe('Tag');

      annot.setIcon('PaperclipTag');
      expect(annot.getIcon()).toBe('PaperclipTag');
    });
  });

  describe('buildFileSpec', () => {
    it('builds file spec dictionary with embedded stream', () => {
      const fileData = new TextEncoder().encode('Hello, PDF!');
      const annot = PdfFileAttachmentAnnotation.create({
        rect: [100, 700, 120, 720],
        file: fileData,
        fileName: 'hello.txt',
        mimeType: 'text/plain',
        description: 'A test file',
      });

      const registry = createMockRegistry();
      const resultDict = annot.buildFileSpec(registry);

      // Should have /FS entry pointing to a ref
      const fsRef = resultDict.get('/FS');
      expect(fsRef).toBeDefined();
      expect(fsRef!.kind).toBe('ref');
    });

    it('returns dict unchanged if no file data', () => {
      const dict = new PdfDict();
      dict.set('/Type', PdfName.of('Annot'));
      dict.set('/Subtype', PdfName.of('FileAttachment'));
      dict.set('/Rect', PdfArray.fromNumbers([0, 0, 20, 20]));

      const annot = PdfFileAttachmentAnnotation.fromDict(dict);
      const registry = createMockRegistry();
      const result = annot.buildFileSpec(registry);

      // No /FS should be added since there's no file data
      expect(result.get('/FS')).toBeUndefined();
    });
  });
});
