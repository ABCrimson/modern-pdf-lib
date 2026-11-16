/**
 * Tests for the HTTP Range-request lazy fetch module.
 *
 * A mock {@link FetchLike} is injected so no real network request is
 * ever made. The mock records the headers it receives and returns
 * synthetic 206 / 200 responses.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createRangeFetcher,
  type FetchLike,
  type FetchLikeResponse,
} from '../../../src/runtime/rangeFetch.js';
import { EnvironmentError, InvalidArgumentError } from '../../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A recorded request issued through the mock transport. */
interface RecordedRequest {
  readonly url: string;
  readonly rangeHeader: string | undefined;
}

/** Build a header bag with a case-insensitive `get`, mirroring `Headers`. */
function makeHeaders(map: Record<string, string>): {
  get(name: string): string | null;
} {
  const lower = new Map<string, string>();
  for (const [key, value] of Object.entries(map)) {
    lower.set(key.toLowerCase(), value);
  }
  return {
    get(name: string): string | null {
      return lower.get(name.toLowerCase()) ?? null;
    },
  };
}

/**
 * Construct a mock {@link FetchLike} that serves slices out of a backing
 * byte array, recording every request it receives.
 */
function makeMockFetch(body: Uint8Array): {
  fetchImpl: FetchLike;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];

  const fetchImpl: FetchLike = (url, init) => {
    const rangeHeader = init?.headers?.['Range'];
    requests.push({ url, rangeHeader });

    // Parse `bytes=<start>-<end>` (inclusive end).
    const match = rangeHeader?.match(/^bytes=(\d+)-(\d+)$/);
    if (match === null || match === undefined) {
      // No / unparseable range — behave like a non-range 200 response.
      const response: FetchLikeResponse = {
        status: 200,
        headers: makeHeaders({
          'Content-Length': String(body.length),
          'Accept-Ranges': 'bytes',
        }),
        arrayBuffer: () =>
          Promise.resolve(
            body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
          ),
      };
      return Promise.resolve(response);
    }

    const start = Number(match[1]);
    const end = Number(match[2]);
    const slice = body.slice(start, end + 1);

    const response: FetchLikeResponse = {
      status: 206,
      headers: makeHeaders({
        'Content-Range': `bytes ${start}-${end}/${body.length}`,
        'Content-Length': String(slice.length),
        'Accept-Ranges': 'bytes',
      }),
      arrayBuffer: () =>
        Promise.resolve(
          slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) as ArrayBuffer,
        ),
    };
    return Promise.resolve(response);
  };

  return { fetchImpl, requests };
}

/** A 100-byte body where `body[i] === i`. */
function makeBody(): Uint8Array {
  const body = new Uint8Array(100);
  for (let i = 0; i < body.length; i += 1) body[i] = i;
  return body;
}

// ---------------------------------------------------------------------------
// fetchRange
// ---------------------------------------------------------------------------

describe('createRangeFetcher.fetchRange', () => {
  it('sends "bytes=0-9" and returns the 10 requested bytes', async () => {
    const body = makeBody();
    const { fetchImpl, requests } = makeMockFetch(body);
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    const bytes = await fetcher.fetchRange(0, 9);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.rangeHeader).toBe('bytes=0-9');
    expect(requests[0]?.url).toBe('https://example.com/doc.pdf');

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(10);
    expect(Array.from(bytes)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('fetches a non-zero inclusive range correctly', async () => {
    const body = makeBody();
    const { fetchImpl, requests } = makeMockFetch(body);
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    const bytes = await fetcher.fetchRange(90, 99);

    expect(requests[0]?.rangeHeader).toBe('bytes=90-99');
    expect(bytes.length).toBe(10);
    expect(bytes[0]).toBe(90);
    expect(bytes[9]).toBe(99);
  });

  it('rejects invalid offsets without issuing a request', async () => {
    const body = makeBody();
    const { fetchImpl, requests } = makeMockFetch(body);
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    await expect(fetcher.fetchRange(-1, 5)).rejects.toThrow(/invalid start/);
    await expect(fetcher.fetchRange(5, 2)).rejects.toThrow(/invalid end/);
    expect(requests).toHaveLength(0);
  });

  it('throws when the server does not return 206', async () => {
    const requests: RecordedRequest[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      requests.push({ url, rangeHeader: init?.headers?.['Range'] });
      const response: FetchLikeResponse = {
        status: 200,
        headers: makeHeaders({ 'Content-Length': '100' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      };
      return Promise.resolve(response);
    };
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    await expect(fetcher.fetchRange(0, 9)).rejects.toThrow(/expected 206/);
  });
});

// ---------------------------------------------------------------------------
// getLength
// ---------------------------------------------------------------------------

describe('createRangeFetcher.getLength', () => {
  it('parses "bytes 0-9/100" Content-Range into total length 100', async () => {
    const requests: RecordedRequest[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      requests.push({ url, rangeHeader: init?.headers?.['Range'] });
      const response: FetchLikeResponse = {
        status: 206,
        headers: makeHeaders({ 'Content-Range': 'bytes 0-9/100' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      };
      return Promise.resolve(response);
    };
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    const length = await fetcher.getLength();
    expect(length).toBe(100);
  });

  it('caches the length so a second call issues no new request', async () => {
    const body = makeBody();
    const { fetchImpl, requests } = makeMockFetch(body);
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    const first = await fetcher.getLength();
    const requestsAfterFirst = requests.length;
    const second = await fetcher.getLength();

    expect(first).toBe(100);
    expect(second).toBe(100);
    expect(requests.length).toBe(requestsAfterFirst);
  });

  it('falls back to Content-Length on a 200 response', async () => {
    const fetchImpl: FetchLike = () => {
      const response: FetchLikeResponse = {
        status: 200,
        headers: makeHeaders({ 'Content-Length': '4242' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      };
      return Promise.resolve(response);
    };
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    expect(await fetcher.getLength()).toBe(4242);
  });
});

// ---------------------------------------------------------------------------
// supportsRanges
// ---------------------------------------------------------------------------

describe('createRangeFetcher.supportsRanges', () => {
  it('returns true when a probe returns 206 Partial Content', async () => {
    const body = makeBody();
    const { fetchImpl } = makeMockFetch(body);
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    expect(await fetcher.supportsRanges()).toBe(true);
  });

  it('returns true on Accept-Ranges: bytes even without a 206', async () => {
    const fetchImpl: FetchLike = () => {
      const response: FetchLikeResponse = {
        status: 200,
        headers: makeHeaders({
          'Accept-Ranges': 'bytes',
          'Content-Length': '10',
        }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      };
      return Promise.resolve(response);
    };
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    expect(await fetcher.supportsRanges()).toBe(true);
  });

  it('returns false when Accept-Ranges is none and no 206 is returned', async () => {
    const fetchImpl: FetchLike = () => {
      const response: FetchLikeResponse = {
        status: 200,
        headers: makeHeaders({
          'Accept-Ranges': 'none',
          'Content-Length': '10',
        }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      };
      return Promise.resolve(response);
    };
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', {
      fetchImpl,
    });

    expect(await fetcher.supportsRanges()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

describe('createRangeFetcher typed errors', () => {
  /** The error `fn` throws; fails the test when it does not throw. */
  function thrownBy(fn: () => unknown): unknown {
    try {
      fn();
    } catch (error) {
      return error;
    }
    return expect.unreachable('the call did not throw');
  }

  /** The reason `promise` rejects with; fails the test when it resolves. */
  async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
      () => expect.unreachable('the promise did not reject'),
      (reason: unknown) => reason,
    );
  }

  it('throws InvalidArgumentError naming start for an invalid start offset', async () => {
    const { fetchImpl } = makeMockFetch(makeBody());
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', { fetchImpl });

    const error = await rejectionOf(fetcher.fetchRange(-1, 5));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({ code: 'invalid-argument', argument: 'start' });
    expect((error as Error).message).toBe('rangeFetch: invalid start offset -1');
  });

  it('throws InvalidArgumentError naming end for an invalid end offset', async () => {
    const { fetchImpl } = makeMockFetch(makeBody());
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', { fetchImpl });

    const error = await rejectionOf(fetcher.fetchRange(5, 2));
    expect(error).toBeInstanceOf(InvalidArgumentError);
    expect(error).toMatchObject({ code: 'invalid-argument', argument: 'end' });
    expect((error as Error).message).toBe('rangeFetch: invalid end offset 2 for start 5');
  });

  it('throws EnvironmentError (network) when the server does not answer 206', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        status: 200,
        headers: makeHeaders({ 'Content-Length': '100' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      });
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', { fetchImpl });

    const error = await rejectionOf(fetcher.fetchRange(0, 9));
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'network' });
    expect((error as Error).message).toBe('rangeFetch: expected 206 Partial Content, received 200');
  });

  it('throws EnvironmentError (network) when no header gives the resource length', async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve({
        status: 200,
        headers: makeHeaders({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    const fetcher = createRangeFetcher('https://example.com/doc.pdf', { fetchImpl });

    const error = await rejectionOf(fetcher.getLength());
    expect(error).toBeInstanceOf(EnvironmentError);
    expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'network' });
  });

  it('throws EnvironmentError (runtime-api) when the runtime has no fetch and none is given', () => {
    vi.stubGlobal('fetch', undefined);
    try {
      const error = thrownBy(() => createRangeFetcher('https://example.com/doc.pdf'));
      expect(error).toBeInstanceOf(EnvironmentError);
      expect(error).toMatchObject({ code: 'environment-unavailable', reason: 'runtime-api' });
      expect((error as Error).message).toBe(
        'rangeFetch: no fetch implementation available; pass options.fetchImpl',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
