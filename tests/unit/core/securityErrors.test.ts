import { describe, expect, it } from 'vitest';
import * as root from '../../../src/index.js';
import {
  RedactionIncompleteError,
  ScriptExecutionDisabledError,
  TimestampVerificationError,
  UnsupportedEncryptionError,
} from '../../../src/errors.js';
import type { RedactionIncompleteReason } from '../../../src/errors.js';

const simple = [
  [ScriptExecutionDisabledError, 'ScriptExecutionDisabledError', 'script-execution-disabled'],
  [TimestampVerificationError, 'TimestampVerificationError', 'timestamp-unverified'],
  [UnsupportedEncryptionError, 'UnsupportedEncryptionError', 'unsupported-encryption-path'],
] as const;

describe.each(simple)('%o', (Ctor, name, code) => {
  it('has the documented name and code', () => {
    const err = new Ctor();
    expect(err.name).toBe(name);
    expect(err.code).toBe(code);
  });

  it('is an Error and an instance of its class', () => {
    const err = new Ctor();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(Ctor);
  });

  it('has a non-empty default message', () => {
    expect(new Ctor().message.length).toBeGreaterThan(0);
  });

  it('keeps a custom message and the cause', () => {
    const cause = new Error('root');
    const err = new Ctor('custom', { cause });
    expect(err.message).toBe('custom');
    expect(err.cause).toBe(cause);
  });

  it('is exported from the root entry', () => {
    expect((root as Record<string, unknown>)[name]).toBe(Ctor);
  });
});

describe('RedactionIncompleteError', () => {
  it('has the documented name and code', () => {
    const err = new RedactionIncompleteError('text-remains', 'text remains');
    expect(err.name).toBe('RedactionIncompleteError');
    expect(err.code).toBe('redaction-incomplete');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RedactionIncompleteError);
  });

  it('carries the reason and page index', () => {
    const err = new RedactionIncompleteError('inline-image', 'inline image', { pageIndex: 2 });
    expect(err.reason).toBe('inline-image');
    expect(err.pageIndex).toBe(2);
    expect(err.message).toBe('inline image');
  });

  it('leaves the page index undefined when none is given', () => {
    expect(new RedactionIncompleteError('annotation', 'm').pageIndex).toBeUndefined();
  });

  it('keeps the cause', () => {
    const cause = new Error('root');
    const err = new RedactionIncompleteError('form-xobject', 'm', { cause, pageIndex: 0 });
    expect(err.cause).toBe(cause);
  });

  it('accepts every reason', () => {
    const reasons: RedactionIncompleteReason[] = [
      'text-remains',
      'form-xobject',
      'image-xobject',
      'unresolved-xobject',
      'inline-image',
      'annotation',
      'unreachable-redact-annotation',
    ];
    for (const reason of reasons) {
      expect(new RedactionIncompleteError(reason, 'm').reason).toBe(reason);
    }
  });

  it('is exported from the root entry', () => {
    expect((root as Record<string, unknown>)['RedactionIncompleteError']).toBe(
      RedactionIncompleteError,
    );
  });
});
