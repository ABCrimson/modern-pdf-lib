/**
 * Regenerates tests/fixtures/legacy-0.26.0 with the PUBLISHED modern-pdf-lib@0.26.0, the earliest
 * version of the range 0.26.0 to 0.40.8 whose AES-256 (revision 6) key derivation the reader
 * still accepts with a warning.
 *
 *   node scripts/legacy-0.26.0/generate.ts           write the fixture and manifest.json
 *   node scripts/legacy-0.26.0/generate.ts --check   regenerate into a temp dir and exit 1 unless
 *                                                    every sha256 equals the committed manifest
 *
 * The test suite never runs this script. The library is installed from npm into a temp directory
 * outside the repo (`npm install --ignore-scripts modern-pdf-lib@0.26.0`, which also installs its
 * one dependency fflate@0.8.2) and verified against the registry integrity below. Its ESM build
 * does not link in current Node (`Export 'AFRelationship' is not defined`), so the CommonJS build
 * (dist/index.cjs) is loaded. The clock (Date, Date.now) and the RNG (crypto.getRandomValues) are
 * pinned before the library is loaded, so every byte is a pure function of this file. Node strips
 * the types, so only erasable syntax is used here.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCER = 'modern-pdf-lib@0.26.0';
const PINNED = {
  'node_modules/modern-pdf-lib': {
    version: '0.26.0',
    integrity:
      'sha512-ye/AoatkDcM9UXuzZfVO2jfvlZ2F4CIKkshVE49RowPG4+5c2J31N6iqIOZFRF8qA+fZo8krzilSkaBUWW+jLA==',
  },
  'node_modules/fflate': {
    version: '0.8.2',
    integrity:
      'sha512-cPJU47OaAoCbg0pBvzsgpTPhmhqI5eJjh/JIu8tPj5q+T7iLvW/JAYUqmE7KOB4R1ZyEhzBaIQpQpardBF5z8A==',
  },
} as const;

const FIXED_MS = Date.UTC(2026, 9, 30, 12, 0, 0);
const USER_PASSWORD = 'user-0260';
const OWNER_PASSWORD = 'owner-0260';
const AUTHOR = 'legacy-0.26.0 generator';
const TITLE = 'aes-256';
const PAGES = ['Encrypted R6 page'] as const;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtureDir = join(repoRoot, 'tests/fixtures/legacy-0.26.0');

interface PdfLike {
  setTitle(title: string): void;
  setAuthor(author: string): void;
  setProducer(producer: string): void;
  setCreationDate(date: Date): void;
  addPage(size: [number, number]): {
    drawText(text: string, options: { x: number; y: number; size: number }): void;
  };
  encrypt(options: {
    userPassword: string;
    ownerPassword: string;
    algorithm: 'aes-256';
  }): Promise<void>;
  save(): Promise<Uint8Array>;
}

interface LegacyLib {
  createPdf(): PdfLike;
}

interface ManifestEntry {
  file: string;
  sha256: string;
  bytes: number;
  producer: string;
  api: string;
  inputs: Record<string, unknown>;
  expect: Record<string, unknown>;
  notes?: string;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function installLegacy(dir: string): void {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ private: true, dependencies: { 'modern-pdf-lib': '0.26.0' } }),
  );
  // A command string runs through the shell, which resolves npm.cmd on Windows (a .cmd file cannot be spawned directly).
  execSync('npm install --ignore-scripts --no-audit --no-fund', { cwd: dir, stdio: 'inherit' });
  const lock = JSON.parse(readFileSync(join(dir, 'node_modules/.package-lock.json'), 'utf8')) as {
    packages: Record<string, { version?: string; integrity?: string }>;
  };
  for (const [path, want] of Object.entries(PINNED)) {
    const got = lock.packages[path];
    if (got?.version !== want.version || got.integrity !== want.integrity) {
      throw new Error(
        `${path}: installed ${got?.version} ${got?.integrity}, expected ${want.version} ${want.integrity}`,
      );
    }
  }
}

/** Pins Date and crypto.getRandomValues; returns the function that restores them. */
function pinClockAndRng(): () => void {
  const RealDate = Date;
  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(FIXED_MS);
      else super(...(args as [number]));
    }
    static override now(): number {
      return FIXED_MS;
    }
  }
  globalThis.Date = PinnedDate as unknown as DateConstructor;
  let seed = 0x0260;
  Object.defineProperty(globalThis.crypto, 'getRandomValues', {
    configurable: true,
    value: <T extends ArrayBufferView | null>(array: T): T => {
      if (array === null) return array;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < bytes.length; i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        bytes[i] = seed >>> 24;
      }
      return array;
    },
  });
  return () => {
    globalThis.Date = RealDate;
    // The own property shadows Crypto.prototype.getRandomValues; deleting it restores the original.
    Reflect.deleteProperty(globalThis.crypto, 'getRandomValues');
  };
}

async function generate(libDir: string, outDir: string): Promise<ManifestEntry[]> {
  const restore = pinClockAndRng();
  try {
    // require() resolves the package's "require" export condition: dist/index.cjs.
    const lib = createRequire(join(libDir, 'package.json'))('modern-pdf-lib') as LegacyLib;
    mkdirSync(outDir, { recursive: true });
    const doc = lib.createPdf();
    doc.setTitle(TITLE);
    doc.setAuthor(AUTHOR);
    doc.setProducer('modern-pdf-lib 0.26.0');
    doc.setCreationDate(new Date(FIXED_MS));
    for (const text of PAGES) {
      const page = doc.addPage([612, 792]);
      page.drawText(text, { x: 72, y: 700, size: 18 });
      // Streams are compressed only when that is smaller, so each page carries filler lines.
      for (let k = 0; k < 20; k++) {
        page.drawText(`filler line ${k} of ${text}`, { x: 72, y: 660 - k * 14, size: 10 });
      }
    }
    await doc.encrypt({
      userPassword: USER_PASSWORD,
      ownerPassword: OWNER_PASSWORD,
      algorithm: 'aes-256',
    });
    const bytes = await doc.save();
    const file = 'encrypted-r6.pdf';
    writeFileSync(join(outDir, file), bytes);
    const manifest: ManifestEntry[] = [
      {
        file,
        sha256: sha256(bytes),
        bytes: bytes.length,
        producer: PRODUCER,
        api: "createPdf(); setTitle/setAuthor/setProducer/setCreationDate; addPage([612, 792]); drawText x21; await encrypt({ userPassword, ownerPassword, algorithm: 'aes-256' }); save()",
        inputs: { pages: PAGES, algorithm: 'aes-256' },
        expect: {
          pageCount: 1,
          info: { Title: TITLE, Author: AUTHOR },
          pageText: PAGES,
          encryption: {
            V: 5,
            R: 6,
            CFM: 'AESV3',
            userPassword: USER_PASSWORD,
            ownerPassword: OWNER_PASSWORD,
          },
        },
        notes: 'Salts and IVs come from the pinned RNG: predictable, test fixtures only.',
      },
    ];
    writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } finally {
    restore();
  }
}

function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const libDir = mkdtempSync(join(tmpdir(), 'mpl-legacy-0.26.0-lib-'));
  const checkDir = check ? mkdtempSync(join(tmpdir(), 'mpl-legacy-0.26.0-out-')) : undefined;
  return (async () => {
    try {
      installLegacy(libDir);
      const manifest = await generate(libDir, checkDir ?? fixtureDir);
      if (checkDir === undefined) {
        // manifest.json lives under tests/, which `pnpm run format:check` covers.
        execSync('pnpm exec oxfmt tests/fixtures/legacy-0.26.0/manifest.json', {
          cwd: repoRoot,
          stdio: 'inherit',
        });
        for (const m of manifest)
          process.stdout.write(`${m.sha256.slice(0, 16)} ${m.bytes} ${m.file}\n`);
        return;
      }
      const committed = JSON.parse(
        readFileSync(join(fixtureDir, 'manifest.json'), 'utf8'),
      ) as ManifestEntry[];
      const bad: string[] = [];
      for (const m of manifest) {
        const want = committed.find((c) => c.file === m.file);
        if (want?.sha256 !== m.sha256)
          bad.push(`${m.file}: ${m.sha256} (committed ${want?.sha256})`);
      }
      for (const c of committed) {
        if (!manifest.some((m) => m.file === c.file)) bad.push(`${c.file}: not regenerated`);
      }
      if (JSON.stringify(committed) !== JSON.stringify(manifest))
        bad.push('manifest.json content differs');
      if (bad.length > 0) {
        process.stderr.write(`legacy-0.26.0 check failed:\n${bad.join('\n')}\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write(`legacy-0.26.0 check ok: ${manifest.length} fixture byte-identical\n`);
      }
    } finally {
      rmSync(libDir, { recursive: true, force: true });
      if (checkDir !== undefined) rmSync(checkDir, { recursive: true, force: true });
    }
  })();
}

await main();
