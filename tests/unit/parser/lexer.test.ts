/**
 * Tests for the PDF lexer (tokenizer).
 *
 * The lexer converts raw PDF bytes into a sequence of tokens. These tests
 * cover every token type, escape sequence, edge case, and public method
 * defined in `PdfLexer`.
 *
 * Reference: PDF 1.7 specification, SS 7.2 (Lexical Conventions).
 */

import { describe, it, expect } from 'vitest';
import { PdfLexer, TokenType } from '../../../src/parser/lexer.js';
import type { Token } from '../../../src/parser/lexer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a string to Uint8Array for the lexer. */
function bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Create a lexer from a plain string. */
function lexer(str: string): PdfLexer {
  return new PdfLexer(bytes(str));
}

/** Collect all tokens (excluding EOF) from a string. */
function tokenize(str: string): Token[] {
  const lex = lexer(str);
  const tokens: Token[] = [];
  let tok = lex.nextToken();
  while (tok.type !== TokenType.EOF) {
    tokens.push(tok);
    tok = lex.nextToken();
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Token type: Number
// ---------------------------------------------------------------------------

describe('PdfLexer - Number tokens', () => {
  it('parses positive integers', () => {
    const tok = lexer('42').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('parses zero', () => {
    const tok = lexer('0').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(0);
  });

  it('parses negative integers', () => {
    const tok = lexer('-7').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(-7);
  });

  it('parses positive sign integer', () => {
    const tok = lexer('+3').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(3);
  });

  it('parses real (floating point) numbers', () => {
    const tok = lexer('3.14').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBeCloseTo(3.14, 5);
  });

  it('parses negative real numbers', () => {
    const tok = lexer('-0.5').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBeCloseTo(-0.5, 5);
  });

  it('parses positive sign real numbers', () => {
    const tok = lexer('+0.5').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBeCloseTo(0.5, 5);
  });

  it('parses leading-dot reals', () => {
    const tok = lexer('.75').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBeCloseTo(0.75, 5);
  });

  it('parses negative leading-dot reals', () => {
    const tok = lexer('-.002').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBeCloseTo(-0.002, 5);
  });

  it('parses trailing-dot reals', () => {
    const tok = lexer('5.').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(5);
  });

  it('parses large integers', () => {
    const tok = lexer('100000').nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(100000);
  });

  it('parses consecutive number tokens', () => {
    const tokens = tokenize('1 2 3');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]!.value).toBe(1);
    expect(tokens[1]!.value).toBe(2);
    expect(tokens[2]!.value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Token type: LiteralString
// ---------------------------------------------------------------------------

describe('PdfLexer - Literal string tokens', () => {
  it('parses a simple literal string', () => {
    const tok = lexer('(Hello)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('Hello');
  });

  it('parses an empty literal string', () => {
    const tok = lexer('()').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('');
  });

  it('handles \\n escape', () => {
    const tok = lexer('(line\\nbreak)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('line\nbreak');
  });

  it('handles \\r escape', () => {
    const tok = lexer('(ret\\rurn)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('ret\rurn');
  });

  it('handles \\t escape', () => {
    const tok = lexer('(tab\\there)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('tab\there');
  });

  it('handles \\b escape', () => {
    const tok = lexer('(back\\bspace)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('back\bspace');
  });

  it('handles \\f escape', () => {
    const tok = lexer('(form\\ffeed)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('form\ffeed');
  });

  it('handles \\\\ escape (backslash)', () => {
    const tok = lexer('(back\\\\slash)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('back\\slash');
  });

  it('handles \\( and \\) escapes (parentheses)', () => {
    const tok = lexer('(open\\(close\\))').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('open(close)');
  });

  it('handles octal escape \\012 (newline)', () => {
    const tok = lexer('(line\\012break)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('line\nbreak');
  });

  it('handles one-digit octal escape', () => {
    const tok = lexer('(char\\0end)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('char\0end');
  });

  it('handles two-digit octal escape', () => {
    // \11 = octal 11 = 9 (tab)
    const tok = lexer('(tab\\11end)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('tab\tend');
  });

  it('handles line continuation with \\LF', () => {
    // A backslash followed by a literal newline byte means line continuation
    const input = new Uint8Array([
      0x28, // (
      0x61, // a
      0x5c, // backslash
      0x0a, // LF
      0x62, // b
      0x29, // )
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('ab');
  });

  it('handles line continuation with \\CR', () => {
    const input = new Uint8Array([
      0x28, // (
      0x61, // a
      0x5c, // backslash
      0x0d, // CR
      0x62, // b
      0x29, // )
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('ab');
  });

  it('handles line continuation with \\CRLF', () => {
    const input = new Uint8Array([
      0x28, // (
      0x61, // a
      0x5c, // backslash
      0x0d, // CR
      0x0a, // LF
      0x62, // b
      0x29, // )
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('ab');
  });

  it('handles nested parentheses (balanced)', () => {
    const tok = lexer('(outer(inner)text)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('outer(inner)text');
  });

  it('handles deeply nested parentheses', () => {
    const tok = lexer('(a(b(c)d)e)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('a(b(c)d)e');
  });

  it('normalizes bare CR to LF inside literal strings', () => {
    // A bare CR (not as escape) should be normalized to LF
    const input = new Uint8Array([
      0x28, // (
      0x61, // a
      0x0d, // CR (bare, not escaped)
      0x62, // b
      0x29, // )
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('a\nb');
  });

  it('normalizes bare CRLF to LF inside literal strings', () => {
    const input = new Uint8Array([
      0x28, // (
      0x61, // a
      0x0d, // CR
      0x0a, // LF
      0x62, // b
      0x29, // )
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('a\nb');
  });

  it('throws on unterminated literal string', () => {
    expect(() => lexer('(unterminated').nextToken()).toThrow(
      /unterminated literal string/i,
    );
  });

  it('handles unknown escape (backslash is ignored per spec)', () => {
    // \z is not a valid PDF escape; the backslash should be ignored
    const tok = lexer('(a\\zb)').nextToken();
    expect(tok.type).toBe(TokenType.LiteralString);
    expect(tok.value).toBe('azb');
  });
});

// ---------------------------------------------------------------------------
// Token type: HexString
// ---------------------------------------------------------------------------

describe('PdfLexer - Hex string tokens', () => {
  it('parses a simple hex string', () => {
    const tok = lexer('<48656C6C6F>').nextToken();
    expect(tok.type).toBe(TokenType.HexString);
    expect(tok.value).toBe('Hello');
  });

  it('parses empty hex string', () => {
    const tok = lexer('<>').nextToken();
    expect(tok.type).toBe(TokenType.HexString);
    expect(tok.value).toBe('');
  });

  it('ignores whitespace inside hex string', () => {
    const tok = lexer('<48 65 6C 6C 6F>').nextToken();
    expect(tok.type).toBe(TokenType.HexString);
    expect(tok.value).toBe('Hello');
  });

  it('appends trailing 0 for odd-length hex', () => {
    // <ABC> becomes <ABC0> = 0xAB, 0xC0
    const tok = lexer('<ABC>').nextToken();
    expect(tok.type).toBe(TokenType.HexString);
    expect(tok.value).toBe(String.fromCharCode(0xab, 0xc0));
  });

  it('handles lowercase hex digits', () => {
    const tok = lexer('<48656c6c6f>').nextToken();
    expect(tok.type).toBe(TokenType.HexString);
    expect(tok.value).toBe('Hello');
  });

  it('handles mixed case hex digits', () => {
    const tok = lexer('<4865 6C6c 6F>').nextToken();
    expect(tok.type).toBe(TokenType.HexString);
    expect(tok.value).toBe('Hello');
  });

  it('throws on invalid hex digit', () => {
    expect(() => lexer('<GHIJ>').nextToken()).toThrow(/invalid hex digit/i);
  });
});

// ---------------------------------------------------------------------------
// Token type: Name
// ---------------------------------------------------------------------------

describe('PdfLexer - Name tokens', () => {
  it('parses a simple name', () => {
    const tok = lexer('/Type').nextToken();
    expect(tok.type).toBe(TokenType.Name);
    expect(tok.value).toBe('/Type');
  });

  it('parses name with multiple characters', () => {
    const tok = lexer('/SomeLongName').nextToken();
    expect(tok.type).toBe(TokenType.Name);
    expect(tok.value).toBe('/SomeLongName');
  });

  it('parses empty name (just /)', () => {
    // A bare "/" is technically a valid empty name in PDF
    const tok = lexer('/ ').nextToken();
    expect(tok.type).toBe(TokenType.Name);
    expect(tok.value).toBe('/');
  });

  it('decodes #XX hex escapes', () => {
    // /Name#20With#20Spaces => /Name With Spaces
    const tok = lexer('/Name#20With#20Spaces').nextToken();
    expect(tok.type).toBe(TokenType.Name);
    expect(tok.value).toBe('/Name With Spaces');
  });

  it('decodes #23 as hash character', () => {
    const tok = lexer('/Name#23Hash').nextToken();
    expect(tok.type).toBe(TokenType.Name);
    expect(tok.value).toBe('/Name#Hash');
  });

  it('stops at whitespace', () => {
    const lex = lexer('/Type /Page');
    const tok1 = lex.nextToken();
    const tok2 = lex.nextToken();
    expect(tok1.value).toBe('/Type');
    expect(tok2.value).toBe('/Page');
  });

  it('stops at delimiters', () => {
    const lex = lexer('/Key(value)');
    const tok1 = lex.nextToken();
    expect(tok1.type).toBe(TokenType.Name);
    expect(tok1.value).toBe('/Key');
    const tok2 = lex.nextToken();
    expect(tok2.type).toBe(TokenType.LiteralString);
    expect(tok2.value).toBe('value');
  });

  it('stops at array delimiters', () => {
    const lex = lexer('/Name[1]');
    const tok1 = lex.nextToken();
    expect(tok1.type).toBe(TokenType.Name);
    expect(tok1.value).toBe('/Name');
    const tok2 = lex.nextToken();
    expect(tok2.type).toBe(TokenType.ArrayStart);
  });

  it('throws on incomplete #XX escape', () => {
    expect(() => lexer('/Foo#2').nextToken()).toThrow(
      /incomplete.*escape/i,
    );
  });

  it('throws on invalid #XX escape', () => {
    expect(() => lexer('/Foo#GG').nextToken()).toThrow(
      /invalid.*escape/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Token type: Boolean
// ---------------------------------------------------------------------------

describe('PdfLexer - Boolean tokens', () => {
  it('parses true', () => {
    const tok = lexer('true').nextToken();
    expect(tok.type).toBe(TokenType.Boolean);
    expect(tok.value).toBe(true);
  });

  it('parses false', () => {
    const tok = lexer('false').nextToken();
    expect(tok.type).toBe(TokenType.Boolean);
    expect(tok.value).toBe(false);
  });

  it('does not confuse "truecolor" as boolean', () => {
    // "truecolor" should be read as a keyword (not as true + color)
    // because the lexer reads until whitespace/delimiter
    const tok = lexer('truecolor').nextToken();
    // It will be parsed as a keyword "truecolor" which is unknown,
    // so it should be a Comment type (unknown keyword fallback)
    expect(tok.type).toBe(TokenType.Comment);
    expect(tok.value).toBe('truecolor');
  });
});

// ---------------------------------------------------------------------------
// Token type: Null
// ---------------------------------------------------------------------------

describe('PdfLexer - Null tokens', () => {
  it('parses null', () => {
    const tok = lexer('null').nextToken();
    expect(tok.type).toBe(TokenType.Null);
    expect(tok.value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Structural tokens
// ---------------------------------------------------------------------------

describe('PdfLexer - Structural tokens', () => {
  it('parses ArrayStart [', () => {
    const tok = lexer('[').nextToken();
    expect(tok.type).toBe(TokenType.ArrayStart);
    expect(tok.value).toBeNull();
  });

  it('parses ArrayEnd ]', () => {
    const tok = lexer(']').nextToken();
    expect(tok.type).toBe(TokenType.ArrayEnd);
    expect(tok.value).toBeNull();
  });

  it('parses DictStart <<', () => {
    const tok = lexer('<<').nextToken();
    expect(tok.type).toBe(TokenType.DictStart);
    expect(tok.value).toBeNull();
  });

  it('parses DictEnd >>', () => {
    const tok = lexer('>>').nextToken();
    expect(tok.type).toBe(TokenType.DictEnd);
    expect(tok.value).toBeNull();
  });

  it('distinguishes << from <hex string>', () => {
    const lex = lexer('<<48>>');
    // Should be DictStart, then Number 48, then DictEnd
    const tok1 = lex.nextToken();
    expect(tok1.type).toBe(TokenType.DictStart);
    const tok2 = lex.nextToken();
    expect(tok2.type).toBe(TokenType.Number);
    expect(tok2.value).toBe(48);
    const tok3 = lex.nextToken();
    expect(tok3.type).toBe(TokenType.DictEnd);
  });

  it('throws on lone >', () => {
    expect(() => lexer('> rest').nextToken()).toThrow(
      /unexpected '>'/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

describe('PdfLexer - Keyword tokens', () => {
  it('parses stream keyword', () => {
    const tok = lexer('stream').nextToken();
    expect(tok.type).toBe(TokenType.StreamKeyword);
    expect(tok.value).toBe('stream');
  });

  it('parses endstream keyword', () => {
    const tok = lexer('endstream').nextToken();
    expect(tok.type).toBe(TokenType.EndStreamKeyword);
    expect(tok.value).toBe('endstream');
  });

  it('parses obj keyword', () => {
    const tok = lexer('obj').nextToken();
    expect(tok.type).toBe(TokenType.ObjKeyword);
    expect(tok.value).toBe('obj');
  });

  it('parses endobj keyword', () => {
    const tok = lexer('endobj').nextToken();
    expect(tok.type).toBe(TokenType.EndObjKeyword);
    expect(tok.value).toBe('endobj');
  });

  it('parses xref keyword', () => {
    const tok = lexer('xref').nextToken();
    expect(tok.type).toBe(TokenType.XrefKeyword);
    expect(tok.value).toBe('xref');
  });

  it('parses trailer keyword', () => {
    const tok = lexer('trailer').nextToken();
    expect(tok.type).toBe(TokenType.TrailerKeyword);
    expect(tok.value).toBe('trailer');
  });

  it('parses startxref keyword', () => {
    const tok = lexer('startxref').nextToken();
    expect(tok.type).toBe(TokenType.StartXrefKeyword);
    expect(tok.value).toBe('startxref');
  });

  it('parses R keyword', () => {
    const tok = lexer('R').nextToken();
    expect(tok.type).toBe(TokenType.Ref);
    expect(tok.value).toBe('R');
  });

  it('treats unknown keywords as Comment tokens', () => {
    const tok = lexer('unknown').nextToken();
    expect(tok.type).toBe(TokenType.Comment);
    expect(tok.value).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe('PdfLexer - Comments', () => {
  it('skips line comments automatically during whitespace skipping', () => {
    // Comments are treated as whitespace and skipped by readToken
    const lex = lexer('% this is a comment\n42');
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('skips multiple comment lines', () => {
    const lex = lexer('% comment 1\n% comment 2\ntrue');
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Boolean);
    expect(tok.value).toBe(true);
  });

  it('skips comment terminated by CR', () => {
    const input = new Uint8Array([
      0x25, // %
      0x63, // c
      0x6f, // o
      0x6d, // m
      0x0d, // CR
      0x34, // 4
      0x32, // 2
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Whitespace handling
// ---------------------------------------------------------------------------

describe('PdfLexer - Whitespace handling', () => {
  it('skips spaces between tokens', () => {
    const tokens = tokenize('  42  ');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.value).toBe(42);
  });

  it('skips tabs between tokens', () => {
    const tokens = tokenize('\t42\t');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.value).toBe(42);
  });

  it('skips LF between tokens', () => {
    const tokens = tokenize('\n42\n');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.value).toBe(42);
  });

  it('skips CR between tokens', () => {
    const input = new Uint8Array([0x0d, 0x34, 0x32, 0x0d]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('skips CRLF between tokens', () => {
    const input = new Uint8Array([
      0x0d, 0x0a, // CRLF
      0x34, 0x32, // 42
      0x0d, 0x0a, // CRLF
    ]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('skips form feed (0x0C)', () => {
    const input = new Uint8Array([0x0c, 0x34, 0x32]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('skips null byte (0x00) as whitespace', () => {
    const input = new Uint8Array([0x00, 0x34, 0x32]);
    const lex = new PdfLexer(input);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('skips mixed whitespace', () => {
    const tokens = tokenize(' \t\n  42  \n\t ');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// EOF
// ---------------------------------------------------------------------------

describe('PdfLexer - EOF', () => {
  it('returns EOF for empty input', () => {
    const tok = lexer('').nextToken();
    expect(tok.type).toBe(TokenType.EOF);
    expect(tok.value).toBeNull();
  });

  it('returns EOF for whitespace-only input', () => {
    const tok = lexer('   \n\t  ').nextToken();
    expect(tok.type).toBe(TokenType.EOF);
  });

  it('returns EOF after all tokens consumed', () => {
    const lex = lexer('42');
    lex.nextToken(); // consume 42
    const eof = lex.nextToken();
    expect(eof.type).toBe(TokenType.EOF);
  });

  it('returns EOF repeatedly once exhausted', () => {
    const lex = lexer('');
    expect(lex.nextToken().type).toBe(TokenType.EOF);
    expect(lex.nextToken().type).toBe(TokenType.EOF);
    expect(lex.nextToken().type).toBe(TokenType.EOF);
  });
});

// ---------------------------------------------------------------------------
// peekToken() vs nextToken()
// ---------------------------------------------------------------------------

describe('PdfLexer - peekToken()', () => {
  it('returns the next token without consuming it', () => {
    const lex = lexer('42 true');
    const peeked = lex.peekToken();
    expect(peeked.type).toBe(TokenType.Number);
    expect(peeked.value).toBe(42);

    // nextToken should return the same token
    const consumed = lex.nextToken();
    expect(consumed.type).toBe(peeked.type);
    expect(consumed.value).toBe(peeked.value);
    expect(consumed.offset).toBe(peeked.offset);
  });

  it('returns same token on multiple peeks', () => {
    const lex = lexer('hello');
    const peek1 = lex.peekToken();
    const peek2 = lex.peekToken();
    expect(peek1).toBe(peek2);
  });

  it('advances correctly after peek + next', () => {
    const lex = lexer('1 2 3');
    lex.peekToken(); // peek at 1
    lex.nextToken();  // consume 1

    lex.peekToken(); // peek at 2
    lex.nextToken();  // consume 2

    const tok = lex.nextToken(); // consume 3
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(3);
  });

  it('peekToken returns EOF for empty input', () => {
    const lex = lexer('');
    expect(lex.peekToken().type).toBe(TokenType.EOF);
  });
});

// ---------------------------------------------------------------------------
// seek() and position management
// ---------------------------------------------------------------------------

describe('PdfLexer - seek() and position', () => {
  it('sets position to the specified offset', () => {
    const lex = lexer('abc 42 true');
    lex.seek(4);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('clears peeked token on seek', () => {
    const lex = lexer('42 true');
    lex.peekToken(); // peeks 42
    lex.seek(3); // seek past "42 "
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Boolean);
    expect(tok.value).toBe(true);
  });

  it('allows seeking to position 0', () => {
    const lex = lexer('42');
    lex.nextToken(); // consume 42
    lex.seek(0);
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('allows seeking to end (length)', () => {
    const lex = lexer('42');
    lex.seek(2); // past the end of "42"
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.EOF);
  });

  it('throws on negative offset', () => {
    const lex = lexer('42');
    expect(() => lex.seek(-1)).toThrow(RangeError);
  });

  it('throws on offset past length', () => {
    const lex = lexer('42');
    expect(() => lex.seek(3)).toThrow(RangeError);
  });

  it('position reflects token consumption', () => {
    const lex = lexer('42 true');
    expect(lex.position).toBe(0);
    lex.nextToken(); // "42"
    // Position should have advanced past "42"
    expect(lex.position).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// readStreamData()
// ---------------------------------------------------------------------------

describe('PdfLexer - readStreamData()', () => {
  it('reads exact number of bytes', () => {
    const content = 'Hello PDF stream data here';
    const lex = lexer(content);
    const data = lex.readStreamData(5);
    expect(data).toEqual(bytes('Hello'));
  });

  it('advances position by the specified length', () => {
    const lex = lexer('0123456789');
    lex.readStreamData(5);
    expect(lex.position).toBe(5);
  });

  it('returns a view (subarray) of the input buffer', () => {
    const lex = lexer('ABCDE');
    const data = lex.readStreamData(3);
    expect(data).toHaveLength(3);
    // Should be a subarray, not a copy
    expect(data[0]).toBe(0x41); // 'A'
    expect(data[1]).toBe(0x42); // 'B'
    expect(data[2]).toBe(0x43); // 'C'
  });

  it('reads zero bytes without error', () => {
    const lex = lexer('data');
    const data = lex.readStreamData(0);
    expect(data).toHaveLength(0);
    expect(lex.position).toBe(0);
  });

  it('throws when not enough bytes remain', () => {
    const lex = lexer('short');
    expect(() => lex.readStreamData(100)).toThrow(
      /requested 100 bytes/i,
    );
  });

  it('reads from current position (not always from 0)', () => {
    const lex = lexer('ABCDEFGH');
    lex.seek(3);
    const data = lex.readStreamData(3);
    expect(data).toEqual(bytes('DEF'));
  });
});

// ---------------------------------------------------------------------------
// skipWhitespace()
// ---------------------------------------------------------------------------

describe('PdfLexer - skipWhitespace()', () => {
  it('advances past spaces', () => {
    const lex = lexer('   42');
    lex.skipWhitespace();
    expect(lex.position).toBe(3);
  });

  it('advances past comments', () => {
    const lex = lexer('% comment\n42');
    lex.skipWhitespace();
    // After skipping comment, position should be at the LF or past it
    // The comment loop skips to end-of-line char but does not skip it;
    // then the outer loop skips the LF as whitespace
    expect(lex.position).toBe(10); // past "% comment\n"
  });

  it('handles multiple comment lines', () => {
    const lex = lexer('% first\n% second\n42');
    lex.skipWhitespace();
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.Number);
    expect(tok.value).toBe(42);
  });

  it('is a no-op when already at a non-whitespace byte', () => {
    const lex = lexer('42');
    lex.skipWhitespace();
    expect(lex.position).toBe(0);
  });

  it('handles being at EOF', () => {
    const lex = lexer('');
    lex.skipWhitespace(); // should not throw
    expect(lex.position).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// byteAt() and length
// ---------------------------------------------------------------------------

describe('PdfLexer - byteAt() and length', () => {
  it('returns the byte at the given offset', () => {
    const lex = lexer('ABC');
    expect(lex.byteAt(0)).toBe(0x41); // A
    expect(lex.byteAt(1)).toBe(0x42); // B
    expect(lex.byteAt(2)).toBe(0x43); // C
  });

  it('returns -1 for out-of-bounds offset', () => {
    const lex = lexer('AB');
    expect(lex.byteAt(-1)).toBe(-1);
    expect(lex.byteAt(2)).toBe(-1);
    expect(lex.byteAt(100)).toBe(-1);
  });

  it('length returns the total byte count', () => {
    const lex = lexer('Hello');
    expect(lex.length).toBe(5);
  });

  it('length is 0 for empty input', () => {
    const lex = lexer('');
    expect(lex.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Complex / integration scenarios
// ---------------------------------------------------------------------------

describe('PdfLexer - Complex token sequences', () => {
  it('tokenizes a simple indirect object definition', () => {
    const tokens = tokenize('5 0 obj (Hello) endobj');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]!.type).toBe(TokenType.Number);
    expect(tokens[0]!.value).toBe(5);
    expect(tokens[1]!.type).toBe(TokenType.Number);
    expect(tokens[1]!.value).toBe(0);
    expect(tokens[2]!.type).toBe(TokenType.ObjKeyword);
    expect(tokens[3]!.type).toBe(TokenType.LiteralString);
    expect(tokens[3]!.value).toBe('Hello');
    expect(tokens[4]!.type).toBe(TokenType.EndObjKeyword);
  });

  it('tokenizes a dictionary', () => {
    const tokens = tokenize('<< /Type /Page /Count 3 >>');
    expect(tokens[0]!.type).toBe(TokenType.DictStart);
    expect(tokens[1]!.type).toBe(TokenType.Name);
    expect(tokens[1]!.value).toBe('/Type');
    expect(tokens[2]!.type).toBe(TokenType.Name);
    expect(tokens[2]!.value).toBe('/Page');
    expect(tokens[3]!.type).toBe(TokenType.Name);
    expect(tokens[3]!.value).toBe('/Count');
    expect(tokens[4]!.type).toBe(TokenType.Number);
    expect(tokens[4]!.value).toBe(3);
    expect(tokens[5]!.type).toBe(TokenType.DictEnd);
  });

  it('tokenizes an array with mixed types', () => {
    const tokens = tokenize('[1 (hello) /Name true null]');
    expect(tokens).toHaveLength(7);
    expect(tokens[0]!.type).toBe(TokenType.ArrayStart);
    expect(tokens[1]!.type).toBe(TokenType.Number);
    expect(tokens[2]!.type).toBe(TokenType.LiteralString);
    expect(tokens[3]!.type).toBe(TokenType.Name);
    expect(tokens[4]!.type).toBe(TokenType.Boolean);
    expect(tokens[5]!.type).toBe(TokenType.Null);
    expect(tokens[6]!.type).toBe(TokenType.ArrayEnd);
  });

  it('tokenizes an indirect reference sequence', () => {
    const tokens = tokenize('5 0 R');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]!.type).toBe(TokenType.Number);
    expect(tokens[0]!.value).toBe(5);
    expect(tokens[1]!.type).toBe(TokenType.Number);
    expect(tokens[1]!.value).toBe(0);
    expect(tokens[2]!.type).toBe(TokenType.Ref);
    expect(tokens[2]!.value).toBe('R');
  });

  it('tokenizes xref section start', () => {
    const tokens = tokenize('xref\n0 5');
    expect(tokens[0]!.type).toBe(TokenType.XrefKeyword);
    expect(tokens[1]!.type).toBe(TokenType.Number);
    expect(tokens[1]!.value).toBe(0);
    expect(tokens[2]!.type).toBe(TokenType.Number);
    expect(tokens[2]!.value).toBe(5);
  });

  it('tokenizes trailer + startxref', () => {
    const tokens = tokenize('trailer << /Size 6 >> startxref 1234');
    expect(tokens[0]!.type).toBe(TokenType.TrailerKeyword);
    expect(tokens[1]!.type).toBe(TokenType.DictStart);
    expect(tokens[2]!.type).toBe(TokenType.Name);
    expect(tokens[2]!.value).toBe('/Size');
    expect(tokens[3]!.type).toBe(TokenType.Number);
    expect(tokens[3]!.value).toBe(6);
    expect(tokens[4]!.type).toBe(TokenType.DictEnd);
    expect(tokens[5]!.type).toBe(TokenType.StartXrefKeyword);
    expect(tokens[6]!.type).toBe(TokenType.Number);
    expect(tokens[6]!.value).toBe(1234);
  });

  it('records correct offsets for tokens', () => {
    const lex = lexer('42 true');
    const tok1 = lex.nextToken();
    expect(tok1.offset).toBe(0);
    const tok2 = lex.nextToken();
    expect(tok2.offset).toBe(3);
  });

  it('handles tokens packed tightly without whitespace', () => {
    const tokens = tokenize('[/Name(string)<AABB>]');
    expect(tokens).toHaveLength(5);
    expect(tokens[0]!.type).toBe(TokenType.ArrayStart);
    expect(tokens[1]!.type).toBe(TokenType.Name);
    expect(tokens[1]!.value).toBe('/Name');
    expect(tokens[2]!.type).toBe(TokenType.LiteralString);
    expect(tokens[2]!.value).toBe('string');
    expect(tokens[3]!.type).toBe(TokenType.HexString);
    expect(tokens[4]!.type).toBe(TokenType.ArrayEnd);
  });

  it('handles stream keyword followed by data', () => {
    const lex = lexer('stream\nHello');
    const tok = lex.nextToken();
    expect(tok.type).toBe(TokenType.StreamKeyword);
    expect(tok.value).toBe('stream');
  });

  it('tokenizes a complete PDF cross-reference footer', () => {
    const input =
      'xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n9\n%%EOF';
    const tokens = tokenize(input);
    expect(tokens[0]!.type).toBe(TokenType.XrefKeyword);
    // The rest of the xref data are numbers and keywords
    const trailerIdx = tokens.findIndex(
      (t) => t.type === TokenType.TrailerKeyword,
    );
    expect(trailerIdx).toBeGreaterThan(0);
    const startxrefIdx = tokens.findIndex(
      (t) => t.type === TokenType.StartXrefKeyword,
    );
    expect(startxrefIdx).toBeGreaterThan(trailerIdx);
  });
});

// ---------------------------------------------------------------------------
// TokenType enum completeness
// ---------------------------------------------------------------------------

describe('TokenType enum', () => {
  it('has all expected token types defined', () => {
    expect(TokenType.Number).toBeDefined();
    expect(TokenType.LiteralString).toBeDefined();
    expect(TokenType.HexString).toBeDefined();
    expect(TokenType.Name).toBeDefined();
    expect(TokenType.Boolean).toBeDefined();
    expect(TokenType.Null).toBeDefined();
    expect(TokenType.ArrayStart).toBeDefined();
    expect(TokenType.ArrayEnd).toBeDefined();
    expect(TokenType.DictStart).toBeDefined();
    expect(TokenType.DictEnd).toBeDefined();
    expect(TokenType.StreamKeyword).toBeDefined();
    expect(TokenType.EndStreamKeyword).toBeDefined();
    expect(TokenType.ObjKeyword).toBeDefined();
    expect(TokenType.EndObjKeyword).toBeDefined();
    expect(TokenType.XrefKeyword).toBeDefined();
    expect(TokenType.TrailerKeyword).toBeDefined();
    expect(TokenType.StartXrefKeyword).toBeDefined();
    expect(TokenType.Ref).toBeDefined();
    expect(TokenType.Comment).toBeDefined();
    expect(TokenType.EOF).toBeDefined();
  });
});
