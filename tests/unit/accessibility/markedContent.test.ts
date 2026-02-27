/**
 * Tests for marked content operators.
 */

import { describe, it, expect } from 'vitest';
import {
  beginMarkedContent,
  beginMarkedContentWithProperties,
  endMarkedContent,
  beginMarkedContentSequence,
  wrapInMarkedContent,
  createMarkedContentScope,
  beginArtifact,
  beginArtifactWithType,
  endArtifact,
} from '../../../src/accessibility/markedContent.js';

// ---------------------------------------------------------------------------
// beginMarkedContent (BMC)
// ---------------------------------------------------------------------------

describe('beginMarkedContent', () => {
  it('produces a BMC operator with tag', () => {
    const result = beginMarkedContent('Span');
    expect(result).toBe('/Span BMC\n');
  });

  it('produces a BMC operator for Artifact', () => {
    const result = beginMarkedContent('Artifact');
    expect(result).toBe('/Artifact BMC\n');
  });
});

// ---------------------------------------------------------------------------
// beginMarkedContentWithProperties (BDC with inline dict)
// ---------------------------------------------------------------------------

describe('beginMarkedContentWithProperties', () => {
  it('produces a BDC operator with properties', () => {
    const result = beginMarkedContentWithProperties('Span', { MCID: 0 });
    expect(result).toContain('/Span');
    expect(result).toContain('BDC');
    expect(result).toContain('/MCID');
    expect(result).toContain('0');
  });

  it('handles name values (prefixed with /)', () => {
    const result = beginMarkedContentWithProperties('Artifact', {
      Type: '/Pagination',
    });
    expect(result).toContain('/Type');
    expect(result).toContain('/Pagination');
  });

  it('handles string values', () => {
    const result = beginMarkedContentWithProperties('Tag', {
      Alt: 'some text',
    });
    expect(result).toContain('(some text)');
  });

  it('handles boolean values', () => {
    const result = beginMarkedContentWithProperties('Tag', {
      Inline: true,
    });
    expect(result).toContain('true');
  });
});

// ---------------------------------------------------------------------------
// endMarkedContent (EMC)
// ---------------------------------------------------------------------------

describe('endMarkedContent', () => {
  it('produces an EMC operator', () => {
    const result = endMarkedContent();
    expect(result).toBe('EMC\n');
  });
});

// ---------------------------------------------------------------------------
// beginMarkedContentSequence
// ---------------------------------------------------------------------------

describe('beginMarkedContentSequence', () => {
  it('produces a BDC operator with MCID', () => {
    const result = beginMarkedContentSequence('P', 0);
    expect(result).toBe('/P <</MCID 0>> BDC\n');
  });

  it('handles different tags and MCIDs', () => {
    const result = beginMarkedContentSequence('H1', 42);
    expect(result).toBe('/H1 <</MCID 42>> BDC\n');
  });

  it('handles custom structure types', () => {
    const result = beginMarkedContentSequence('CustomType', 7);
    expect(result).toBe('/CustomType <</MCID 7>> BDC\n');
  });
});

// ---------------------------------------------------------------------------
// wrapInMarkedContent
// ---------------------------------------------------------------------------

describe('wrapInMarkedContent', () => {
  it('wraps operators in BDC/EMC', () => {
    const ops = 'BT /F1 12 Tf (Hello) Tj ET\n';
    const result = wrapInMarkedContent(ops, 'P', 0);

    expect(result).toBe(
      '/P <</MCID 0>> BDC\n' +
      'BT /F1 12 Tf (Hello) Tj ET\n' +
      'EMC\n',
    );
  });

  it('handles empty operators', () => {
    const result = wrapInMarkedContent('', 'Span', 5);
    expect(result).toBe('/Span <</MCID 5>> BDC\nEMC\n');
  });
});

// ---------------------------------------------------------------------------
// createMarkedContentScope
// ---------------------------------------------------------------------------

describe('createMarkedContentScope', () => {
  it('creates a scope with begin and end methods', () => {
    const scope = createMarkedContentScope('P', 3);

    expect(scope.mcid).toBe(3);
    expect(scope.tag).toBe('P');
    expect(scope.begin()).toBe('/P <</MCID 3>> BDC\n');
    expect(scope.end()).toBe('EMC\n');
  });

  it('can be called multiple times', () => {
    const scope = createMarkedContentScope('H1', 0);

    // begin/end should be deterministic
    expect(scope.begin()).toBe(scope.begin());
    expect(scope.end()).toBe(scope.end());
  });
});

// ---------------------------------------------------------------------------
// Artifact helpers
// ---------------------------------------------------------------------------

describe('beginArtifact', () => {
  it('produces an Artifact BMC', () => {
    const result = beginArtifact();
    expect(result).toBe('/Artifact BMC\n');
  });
});

describe('beginArtifactWithType', () => {
  it('produces an Artifact BDC with type', () => {
    const result = beginArtifactWithType('Pagination');
    expect(result).toContain('/Artifact');
    expect(result).toContain('BDC');
    expect(result).toContain('/Type');
    expect(result).toContain('/Pagination');
  });

  it('includes subtype when provided', () => {
    const result = beginArtifactWithType('Pagination', 'Header');
    expect(result).toContain('/Subtype');
    expect(result).toContain('/Header');
  });

  it('handles Background type', () => {
    const result = beginArtifactWithType('Background');
    expect(result).toContain('/Background');
  });

  it('handles Layout type with Watermark subtype', () => {
    const result = beginArtifactWithType('Layout', 'Watermark');
    expect(result).toContain('/Layout');
    expect(result).toContain('/Watermark');
  });
});

describe('endArtifact', () => {
  it('produces an EMC operator', () => {
    const result = endArtifact();
    expect(result).toBe('EMC\n');
  });
});

// ---------------------------------------------------------------------------
// Integration: building a complete tagged content stream
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('builds a complete tagged content stream', () => {
    const parts: string[] = [];

    // Header
    const headerScope = createMarkedContentScope('H1', 0);
    parts.push(headerScope.begin());
    parts.push('BT /F1 24 Tf 50 750 Td (Title) Tj ET\n');
    parts.push(headerScope.end());

    // Paragraph
    parts.push(beginMarkedContentSequence('P', 1));
    parts.push('BT /F1 12 Tf 50 700 Td (Hello world.) Tj ET\n');
    parts.push(endMarkedContent());

    // Artifact (page number)
    parts.push(beginArtifact());
    parts.push('BT /F1 10 Tf 280 30 Td (1) Tj ET\n');
    parts.push(endArtifact());

    const contentStream = parts.join('');

    // Verify structure
    expect(contentStream).toContain('/H1 <</MCID 0>> BDC');
    expect(contentStream).toContain('/P <</MCID 1>> BDC');
    expect(contentStream).toContain('/Artifact BMC');
    // Should have 3 EMCs (one for each scope)
    expect(contentStream.split('EMC').length - 1).toBe(3);
  });
});
