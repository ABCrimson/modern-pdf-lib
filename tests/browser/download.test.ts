import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock browser globals before importing the module
// ---------------------------------------------------------------------------

let mockAnchor: Record<string, unknown>;
let appendChildSpy: ReturnType<typeof vi.fn>;
let removeChildSpy: ReturnType<typeof vi.fn>;
let createObjectURLSpy: ReturnType<typeof vi.fn>;
let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Mock anchor element
  mockAnchor = { href: '', download: '', click: vi.fn() };

  // Mock document.createElement / body.appendChild / body.removeChild
  const createElementSpy = vi.fn(() => mockAnchor);
  appendChildSpy = vi.fn();
  removeChildSpy = vi.fn();

  vi.stubGlobal('document', {
    createElement: createElementSpy,
    body: {
      appendChild: appendChildSpy,
      removeChild: removeChildSpy,
    },
  });

  // Mock URL.createObjectURL / revokeObjectURL
  let urlCounter = 0;
  createObjectURLSpy = vi.fn(() => `blob:http://localhost/mock-${++urlCounter}`);
  revokeObjectURLSpy = vi.fn();

  // Preserve the real URL constructor but replace the static methods
  const RealURL = globalThis.URL;
  vi.stubGlobal('URL', Object.assign(RealURL, {
    createObjectURL: createObjectURLSpy,
    revokeObjectURL: revokeObjectURLSpy,
  }));

  // Mock globalThis.open
  openSpy = vi.fn(() => ({ closed: false }));
  vi.stubGlobal('open', openSpy);

  // Mock queueMicrotask to run synchronously in tests
  vi.stubGlobal('queueMicrotask', (fn: () => void) => fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Import after mocks are set up (use dynamic import to get fresh module)
// ---------------------------------------------------------------------------

async function getModule() {
  // Clear module cache so mocks take effect each time
  return import('../../src/browser/download.js');
}

// Test data: %PDF magic bytes
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

// ---------------------------------------------------------------------------
// saveAsBlob
// ---------------------------------------------------------------------------

describe('saveAsBlob', () => {
  it('returns a Blob with application/pdf type', async () => {
    const { saveAsBlob } = await getModule();
    const blob = saveAsBlob(PDF_BYTES);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
  });

  it('preserves byte content', async () => {
    const { saveAsBlob } = await getModule();
    const blob = saveAsBlob(PDF_BYTES);
    const buffer = await blob.arrayBuffer();
    expect(new Uint8Array(buffer)).toEqual(PDF_BYTES);
  });

  it('handles empty bytes', async () => {
    const { saveAsBlob } = await getModule();
    const blob = saveAsBlob(new Uint8Array(0));
    expect(blob.size).toBe(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('handles large byte arrays', async () => {
    const { saveAsBlob } = await getModule();
    const large = new Uint8Array(100_000);
    large.fill(0x41);
    const blob = saveAsBlob(large);
    expect(blob.size).toBe(100_000);
    expect(blob.type).toBe('application/pdf');
  });
});

// ---------------------------------------------------------------------------
// saveAsDataUrl
// ---------------------------------------------------------------------------

describe('saveAsDataUrl', () => {
  it('returns a blob: URL string', async () => {
    const { saveAsDataUrl } = await getModule();
    const url = saveAsDataUrl(PDF_BYTES);
    expect(typeof url).toBe('string');
    expect(url.startsWith('blob:')).toBe(true);
  });

  it('calls URL.createObjectURL with a Blob', async () => {
    const { saveAsDataUrl } = await getModule();
    saveAsDataUrl(PDF_BYTES);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const arg = createObjectURLSpy.mock.calls[0][0];
    expect(arg).toBeInstanceOf(Blob);
    expect(arg.type).toBe('application/pdf');
  });
});

// ---------------------------------------------------------------------------
// saveAsDownload
// ---------------------------------------------------------------------------

describe('saveAsDownload', () => {
  it('uses default filename "document.pdf"', async () => {
    const { saveAsDownload } = await getModule();
    saveAsDownload(PDF_BYTES);
    expect(mockAnchor.download).toBe('document.pdf');
  });

  it('uses custom filename when provided', async () => {
    const { saveAsDownload } = await getModule();
    saveAsDownload(PDF_BYTES, 'invoice-2026.pdf');
    expect(mockAnchor.download).toBe('invoice-2026.pdf');
  });

  it('creates an anchor element and clicks it', async () => {
    const { saveAsDownload } = await getModule();
    saveAsDownload(PDF_BYTES);

    // Should create an <a> element
    expect(document.createElement).toHaveBeenCalledWith('a');

    // Should append to body, click, then remove
    expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
  });

  it('sets the anchor href to a blob URL', async () => {
    const { saveAsDownload } = await getModule();
    saveAsDownload(PDF_BYTES);
    expect(typeof mockAnchor.href).toBe('string');
    expect((mockAnchor.href as string).startsWith('blob:')).toBe(true);
  });

  it('revokes the object URL after download starts', async () => {
    const { saveAsDownload } = await getModule();
    saveAsDownload(PDF_BYTES);
    // queueMicrotask is mocked to run synchronously
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockAnchor.href);
  });
});

// ---------------------------------------------------------------------------
// openInNewTab
// ---------------------------------------------------------------------------

describe('openInNewTab', () => {
  it('calls globalThis.open with a blob URL and _blank target', async () => {
    const { openInNewTab } = await getModule();
    openInNewTab(PDF_BYTES);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(typeof url).toBe('string');
    expect(url.startsWith('blob:')).toBe(true);
    expect(target).toBe('_blank');
  });

  it('accepts a custom target', async () => {
    const { openInNewTab } = await getModule();
    openInNewTab(PDF_BYTES, '_self');

    const [, target] = openSpy.mock.calls[0];
    expect(target).toBe('_self');
  });

  it('returns the window reference from globalThis.open', async () => {
    const { openInNewTab } = await getModule();
    const fakeWindow = { closed: false };
    openSpy.mockReturnValue(fakeWindow);

    const result = openInNewTab(PDF_BYTES);
    expect(result).toBe(fakeWindow);
  });

  it('returns null when popup is blocked', async () => {
    const { openInNewTab } = await getModule();
    openSpy.mockReturnValue(null);

    const result = openInNewTab(PDF_BYTES);
    expect(result).toBeNull();
  });

  it('calls URL.createObjectURL for the blob', async () => {
    const { openInNewTab } = await getModule();
    const callsBefore = createObjectURLSpy.mock.calls.length;
    openInNewTab(PDF_BYTES);
    expect(createObjectURLSpy.mock.calls.length).toBe(callsBefore + 1);
    const arg = createObjectURLSpy.mock.calls[createObjectURLSpy.mock.calls.length - 1][0];
    expect(arg).toBeInstanceOf(Blob);
    expect(arg.type).toBe('application/pdf');
  });
});

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

describe('module exports', () => {
  it('exports all four functions', async () => {
    const mod = await getModule();
    expect(typeof mod.saveAsDownload).toBe('function');
    expect(typeof mod.saveAsBlob).toBe('function');
    expect(typeof mod.saveAsDataUrl).toBe('function');
    expect(typeof mod.openInNewTab).toBe('function');
  });
});
