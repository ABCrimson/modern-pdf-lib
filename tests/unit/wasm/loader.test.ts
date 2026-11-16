/**
 * @module tests/unit/wasm/loader
 *
 * The WASM loader rejects a module name it does not know before it looks for a file, and every way
 * it fails to bring a module in is a typed error: a refused name is an InvalidArgumentError, a
 * module the runtime cannot provide an EnvironmentError. Under Node a module is read from a file
 * path or a `file:` URL, and both name the file the platform means: a directory with a space or a
 * non-ASCII letter in its name, a percent-escape, a drive letter and a UNC share all resolve.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWasmCache,
  configureWasmLoader,
  instantiateWasmModuleStreaming,
  loadWasmModule,
  loadWasmModuleStreaming,
  packagedModuleUrl,
  toFileSystemPath,
} from '../../../src/wasm/loader.js';
import { EnvironmentError, InvalidArgumentError } from '../../../src/errors.js';

/** The reason `promise` rejects with; fails the test when it resolves. */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => expect.unreachable('the promise did not reject'),
    (reason: unknown) => reason,
  );
}

afterEach(() => {
  configureWasmLoader({});
  vi.unstubAllGlobals();
});

describe('loadWasmModule', () => {
  it('rejects a module name it does not know', async () => {
    await expect(loadWasmModule('no-such-crate')).rejects.toThrow(
      'Unknown WASM module: "no-such-crate"',
    );
  });

  it('rejects a module name it does not know with an InvalidArgumentError naming the name', async () => {
    const error = await rejectionOf(loadWasmModule('no-such-crate'));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({ code: 'invalid-argument', argument: 'name' });
    expect((error as Error).message).toBe(
      'Unknown WASM module: "no-such-crate". Known modules: libdeflate, png, ttf, shaping, jbig2, jpeg',
    );
  });

  it('rejects every load with an EnvironmentError (wasm) when WASM is disabled', async () => {
    configureWasmLoader({ disableWasm: true });
    for (const load of [
      () => loadWasmModule('libdeflate'),
      () => loadWasmModuleStreaming('libdeflate'),
      () => instantiateWasmModuleStreaming('libdeflate'),
    ]) {
      const error = await rejectionOf(load());
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toBe(
        'WASM loading is disabled via configureWasmLoader({ disableWasm: true }). Using pure-JS fallbacks.',
      );
    }
  });

  it('rejects with an EnvironmentError (network) when the fetch of a module answers an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' })),
    );
    configureWasmLoader({ modulePaths: { libdeflate: 'https://example.invalid/deflate.wasm' } });

    const error = await rejectionOf(loadWasmModule('libdeflate'));
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'network' });
    expect((error as Error).message).toBe(
      'Failed to fetch WASM module: 404 Not Found (https://example.invalid/deflate.wasm)',
    );
  });

  it('rejects with an EnvironmentError (wasm) caused by the read error when the file is missing', async () => {
    configureWasmLoader({ modulePaths: { libdeflate: 'no-such-dir/no-such-file.wasm' } });

    const error = await rejectionOf(loadWasmModule('libdeflate'));
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
    expect((error as Error).message).toContain(
      'Failed to load WASM module from filesystem: no-such-dir/no-such-file.wasm -- ',
    );
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  describe('reading a module from the file system under Node', () => {
    const FILENAME = 'modern_pdf_deflate_bg.wasm';
    /** The 8-byte header of an empty WebAssembly module: enough to tell the file from another. */
    const WASM_HEADER = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    let directory: string;
    let file: string;

    beforeEach(async () => {
      clearWasmCache();
      // A space and non-ASCII letters: the characters a file URL writes as percent-escapes.
      directory = await mkdtemp(join(tmpdir(), 'mpl wasm \u00e9\u00fc '));
      file = join(directory, FILENAME);
      await writeFile(file, WASM_HEADER);
    });

    afterEach(async () => {
      clearWasmCache();
      await rm(directory, { recursive: true, force: true });
    });

    it('reads a module from an absolute file path', async () => {
      configureWasmLoader({ modulePaths: { libdeflate: file } });
      expect(await loadWasmModule('libdeflate')).toEqual(WASM_HEADER);
    });

    it('reads a module from a relative file path', async (context) => {
      const relativePath = relative(process.cwd(), file);
      if (isAbsolute(relativePath)) {
        // The temporary directory is on another drive than the working directory.
        context.skip();
      }
      configureWasmLoader({ modulePaths: { libdeflate: relativePath } });
      expect(await loadWasmModule('libdeflate')).toEqual(WASM_HEADER);
    });

    it('reads a module from a base path that is a directory path', async () => {
      configureWasmLoader({ basePath: directory });
      expect(await loadWasmModule('libdeflate')).toEqual(WASM_HEADER);
    });

    it('reads a module from a file URL with percent-escapes', async () => {
      const url = pathToFileURL(file).href;
      expect(url).toContain('%20');
      configureWasmLoader({ modulePaths: { libdeflate: url } });
      expect(await loadWasmModule('libdeflate')).toEqual(WASM_HEADER);
    });

    it('reads a module from a base path that is a file URL with percent-escapes', async () => {
      configureWasmLoader({ basePath: pathToFileURL(directory).href });
      expect(await loadWasmModule('libdeflate')).toEqual(WASM_HEADER);
    });

    it('names the file the platform means when the packaged file is missing', async () => {
      // The default location of a module is next to this package's loader; the source tree has
      // no such folder, so the read fails and the error carries the path it tried.
      const error = await rejectionOf(loadWasmModule('libdeflate'));
      expect(error).toBeInstanceOf(EnvironmentError);
      const expected = fileURLToPath(
        new URL('../../../src/wasm/wasm/libdeflate/modern_pdf_deflate_bg.wasm', import.meta.url),
      );
      expect(((error as Error).cause as NodeJS.ErrnoException).path).toBe(expected);
    });

    it('rejects a file URL that names no file with an EnvironmentError (wasm) caused by the conversion', async () => {
      // An encoded slash cannot be a path separator, on any platform.
      configureWasmLoader({ modulePaths: { libdeflate: 'file:///a%2Fb.wasm' } });
      const error = await rejectionOf(loadWasmModule('libdeflate'));
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).cause).toBeInstanceOf(TypeError);
    });
  });

  describe('in a Workers runtime', () => {
    /**
     * Calls `load` while the globals that `detectRuntime()` reads describe Cloudflare Workers. The
     * loader reads them before its first await, so the globals are put back before this returns.
     */
    function inWorkers<T>(load: () => Promise<T>): Promise<T> {
      const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
      vi.stubGlobal('caches', {});
      vi.stubGlobal('navigator', { userAgent: 'Cloudflare-Workers' });
      Reflect.deleteProperty(globalThis, 'process');
      try {
        return load();
      } finally {
        if (processDescriptor !== undefined) {
          Object.defineProperty(globalThis, 'process', processDescriptor);
        }
        vi.unstubAllGlobals();
      }
    }

    it('rejects a module with no configured bytes or path with an EnvironmentError (wasm)', async () => {
      const error = await rejectionOf(inWorkers(() => loadWasmModule('libdeflate')));
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toContain(
        'Cannot auto-resolve WASM path in Workers/Edge runtime.',
      );
    });

    it('rejects a module that only has a path with an EnvironmentError (wasm)', async () => {
      configureWasmLoader({ modulePaths: { libdeflate: '/assets/deflate.wasm' } });

      const error = await rejectionOf(inWorkers(() => loadWasmModule('libdeflate')));
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'wasm' });
      expect((error as Error).message).toBe(
        'WASM module "libdeflate" cannot be auto-loaded in Workers/Edge. ' +
          'Provide bytes via configureWasmLoader().',
      );
    });
  });
});

describe('packagedModuleUrl', () => {
  const FILE = 'modern_pdf_deflate_bg.wasm';

  it('names the file in the wasm folder next to the loader, as a file URL', () => {
    expect(packagedModuleUrl('libdeflate', FILE, 'file:///opt/pkg/dist/loader-abc.mjs')).toBe(
      `file:///opt/pkg/dist/wasm/libdeflate/${FILE}`,
    );
  });

  it('keeps a space and a non-ASCII letter of the install directory as percent-escapes', () => {
    expect(
      packagedModuleUrl(
        'libdeflate',
        FILE,
        'file:///C:/Users/J%C3%BCrgen/my%20app/dist/loader.mjs',
      ),
    ).toBe(`file:///C:/Users/J%C3%BCrgen/my%20app/dist/wasm/libdeflate/${FILE}`);
  });
});

describe('toFileSystemPath', () => {
  const FILE = 'modern_pdf_deflate_bg.wasm';

  it('gives a drive-letter path on Windows, without the leading slash and the escapes', async () => {
    const url = packagedModuleUrl(
      'libdeflate',
      FILE,
      'file:///C:/Users/J%C3%BCrgen/my%20app/dist/loader.mjs',
    );
    expect(await toFileSystemPath(url, { windows: true })).toBe(
      `C:\\Users\\J\u00fcrgen\\my app\\dist\\wasm\\libdeflate\\${FILE}`,
    );
  });

  it('gives a UNC path on Windows for a file URL with a host', async () => {
    const url = packagedModuleUrl('libdeflate', FILE, 'file://server/share/pkg/dist/loader.mjs');
    expect(await toFileSystemPath(url, { windows: true })).toBe(
      `\\\\server\\share\\pkg\\dist\\wasm\\libdeflate\\${FILE}`,
    );
  });

  it('gives an absolute path with the escapes decoded on POSIX', async () => {
    const url = packagedModuleUrl(
      'libdeflate',
      FILE,
      'file:///home/j%C3%BCrgen/my%20app/dist/loader.mjs',
    );
    expect(await toFileSystemPath(url, { windows: false })).toBe(
      `/home/j\u00fcrgen/my app/dist/wasm/libdeflate/${FILE}`,
    );
  });

  it('gives the path of this host by default', async () => {
    const url = pathToFileURL(join(tmpdir(), 'a b', FILE));
    expect(await toFileSystemPath(url.href)).toBe(fileURLToPath(url));
  });

  it.each(['C:\\wasm\\x.wasm', '/opt/pkg/x.wasm', 'wasm/x.wasm', 'https://example.invalid/x.wasm'])(
    'returns %s, which is not a file URL, unchanged',
    async (location) => {
      expect(await toFileSystemPath(location, { windows: true })).toBe(location);
      expect(await toFileSystemPath(location, { windows: false })).toBe(location);
    },
  );
});
