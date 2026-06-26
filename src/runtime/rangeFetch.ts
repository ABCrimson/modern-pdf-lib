/**
 * @module runtime/rangeFetch
 *
 * HTTP Range-request lazy fetch — progressively open a remote PDF by
 * fetching only the byte ranges that are actually needed instead of
 * downloading the whole file up front.
 *
 * The implementation is pure logic: the underlying transport is injected
 * via a {@link FetchLike} function so it can be unit-tested without
 * touching the network. By default it uses `globalThis.fetch`.
 *
 * Range semantics follow RFC 7233:
 *
 * - A range request carries a `Range: bytes=<start>-<end>` header where
 *   `<end>` is **inclusive**.
 * - A server that honours the range replies with `206 Partial Content`
 *   and a `Content-Range: bytes <start>-<end>/<total>` header.
 * - A server that ignores the range replies with `200 OK` and the full
 *   body.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal response shape consumed by the range fetcher. A subset of the
 * standard `Response` interface, declared explicitly so non-`fetch`
 * transports can be injected.
 */
export interface FetchLikeResponse {
  /** HTTP status code (e.g. `200`, `206`). */
  readonly status: number;
  /** Response headers accessor. */
  readonly headers: { get(name: string): string | null };
  /** Resolve the body as an {@link ArrayBuffer}. */
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * The injectable transport. Compatible with the global `fetch` function
 * for the subset of features the range fetcher relies on.
 */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<FetchLikeResponse>;

/**
 * A lazy, range-aware reader over a single remote resource.
 */
export interface RangeFetcher {
  /**
   * Fetch the half-open... actually inclusive byte range `[start, end]`.
   *
   * @param start - First byte offset (inclusive, >= 0).
   * @param end   - Last byte offset (inclusive, >= start).
   * @returns The requested bytes as a {@link Uint8Array}.
   */
  fetchRange(start: number, end: number): Promise<Uint8Array>;
  /**
   * Resolve the total length of the resource in bytes. The result is
   * cached after the first successful probe.
   */
  getLength(): Promise<number>;
  /**
   * Determine whether the server supports byte-range requests. The
   * result is cached after the first probe.
   */
  supportsRanges(): Promise<boolean>;
}

/**
 * Options for {@link createRangeFetcher}.
 */
export interface RangeFetchOptions {
  /**
   * Transport used to issue requests. Defaults to `globalThis.fetch`
   * bound to the global object.
   */
  readonly fetchImpl?: FetchLike | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the default transport from the global scope.
 *
 * @throws If no `fetch` implementation is available in the environment.
 */
function resolveDefaultFetch(): FetchLike {
  const globalFetch = (globalThis as { fetch?: unknown }).fetch;
  if (typeof globalFetch !== 'function') {
    throw new Error(
      'rangeFetch: no fetch implementation available; pass options.fetchImpl',
    );
  }
  return (globalFetch as FetchLike).bind(globalThis);
}

/**
 * Parse the total resource length out of a `Content-Range` header value
 * such as `bytes 0-9/100`.
 *
 * @returns The parsed total, or `undefined` when the header is absent,
 *          malformed, or reports an unknown total (`*`).
 */
function parseTotalFromContentRange(value: string | null): number | undefined {
  if (value === null) return undefined;
  const slash = value.lastIndexOf('/');
  if (slash === -1) return undefined;
  const totalPart = value.slice(slash + 1).trim();
  if (totalPart === '' || totalPart === '*') return undefined;
  const total = Number(totalPart);
  if (!Number.isInteger(total) || total < 0) return undefined;
  return total;
}

/**
 * Parse a non-negative integer length from a `Content-Length` header.
 */
function parseContentLength(value: string | null): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const length = Number(trimmed);
  if (!Number.isInteger(length) || length < 0) return undefined;
  return length;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a {@link RangeFetcher} for the given URL.
 *
 * The returned fetcher is stateful: it lazily caches the resource length
 * and the range-support flag after the first successful probe.
 *
 * @param url     - Absolute URL of the remote resource.
 * @param options - Optional {@link RangeFetchOptions}.
 * @returns A {@link RangeFetcher}.
 */
export function createRangeFetcher(
  url: string,
  options?: RangeFetchOptions,
): RangeFetcher {
  const fetchImpl: FetchLike = options?.fetchImpl ?? resolveDefaultFetch();

  let cachedLength: number | undefined;
  let cachedSupportsRanges: boolean | undefined;

  /**
   * Issue a single range request and return the raw response. Also
   * opportunistically populates the length / support caches from the
   * response headers.
   */
  async function requestRange(
    start: number,
    end: number,
  ): Promise<FetchLikeResponse> {
    const response = await fetchImpl(url, {
      headers: { Range: `bytes=${start}-${end}` },
    });

    // Opportunistically learn from the response.
    if (response.status === 206) {
      cachedSupportsRanges = true;
      if (cachedLength === undefined) {
        const total = parseTotalFromContentRange(
          response.headers.get('Content-Range'),
        );
        if (total !== undefined) cachedLength = total;
      }
    } else if (response.status === 200) {
      // Server ignored the range header.
      cachedSupportsRanges = false;
      if (cachedLength === undefined) {
        const length = parseContentLength(
          response.headers.get('Content-Length'),
        );
        if (length !== undefined) cachedLength = length;
      }
    }

    return response;
  }

  async function fetchRange(start: number, end: number): Promise<Uint8Array> {
    if (!Number.isInteger(start) || start < 0) {
      throw new Error(`rangeFetch: invalid start offset ${start}`);
    }
    if (!Number.isInteger(end) || end < start) {
      throw new Error(`rangeFetch: invalid end offset ${end} for start ${start}`);
    }

    const response = await requestRange(start, end);
    if (response.status !== 206) {
      throw new Error(
        `rangeFetch: expected 206 Partial Content, received ${response.status}`,
      );
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function getLength(): Promise<number> {
    if (cachedLength !== undefined) return cachedLength;

    // Probe with a single-byte range; the Content-Range total reveals
    // the full length without downloading the body.
    const response = await requestRange(0, 0);

    if (response.status === 206) {
      const total = parseTotalFromContentRange(
        response.headers.get('Content-Range'),
      );
      if (total !== undefined) {
        cachedLength = total;
        return total;
      }
    }

    // Fall back to Content-Length (e.g. a 200 response).
    const length = parseContentLength(response.headers.get('Content-Length'));
    if (length !== undefined) {
      cachedLength = length;
      return length;
    }

    throw new Error(
      'rangeFetch: unable to determine resource length from response headers',
    );
  }

  async function supportsRanges(): Promise<boolean> {
    if (cachedSupportsRanges !== undefined) return cachedSupportsRanges;

    const response = await requestRange(0, 0);

    // A 206 is the definitive signal that ranges are honoured.
    if (response.status === 206) {
      cachedSupportsRanges = true;
      return true;
    }

    // Otherwise consult Accept-Ranges. `bytes` => supported, `none` or
    // absent => not supported.
    const acceptRanges = response.headers.get('Accept-Ranges');
    const supported =
      acceptRanges !== null && acceptRanges.trim().toLowerCase() === 'bytes';
    cachedSupportsRanges = supported;
    return supported;
  }

  return { fetchRange, getLength, supportsRanges };
}
