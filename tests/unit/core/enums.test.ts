import { describe, it, expect } from 'vitest';
import { BlendMode, TextRenderingMode } from '../../../src/core/enums.js';

describe('BlendMode', () => {
  it('has all 12 PDF blend modes', () => {
    expect(BlendMode.Normal).toBe('Normal');
    expect(BlendMode.Multiply).toBe('Multiply');
    expect(BlendMode.Screen).toBe('Screen');
    expect(BlendMode.Overlay).toBe('Overlay');
    expect(BlendMode.Darken).toBe('Darken');
    expect(BlendMode.Lighten).toBe('Lighten');
    expect(BlendMode.ColorDodge).toBe('ColorDodge');
    expect(BlendMode.ColorBurn).toBe('ColorBurn');
    expect(BlendMode.HardLight).toBe('HardLight');
    expect(BlendMode.SoftLight).toBe('SoftLight');
    expect(BlendMode.Difference).toBe('Difference');
    expect(BlendMode.Exclusion).toBe('Exclusion');
  });

  it('has exactly 12 entries', () => {
    expect(Object.keys(BlendMode)).toHaveLength(12);
  });
});

describe('TextRenderingMode', () => {
  it('has all 8 PDF text rendering modes', () => {
    expect(TextRenderingMode.Fill).toBe(0);
    expect(TextRenderingMode.Outline).toBe(1);
    expect(TextRenderingMode.FillAndOutline).toBe(2);
    expect(TextRenderingMode.Invisible).toBe(3);
    expect(TextRenderingMode.FillAndClip).toBe(4);
    expect(TextRenderingMode.OutlineAndClip).toBe(5);
    expect(TextRenderingMode.FillAndOutlineAndClip).toBe(6);
    expect(TextRenderingMode.Clip).toBe(7);
  });

  it('has exactly 8 entries', () => {
    expect(Object.keys(TextRenderingMode)).toHaveLength(8);
  });
});
