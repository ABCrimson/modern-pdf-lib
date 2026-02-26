import { describe, it, expect } from 'vitest';
import { PageSizes } from '../../../src/core/pdfPage.js';

describe('PageSizes', () => {
  // ISO A series
  it('includes 4A0', () => {
    expect(PageSizes['4A0']).toEqual([4767.87, 6740.79]);
  });
  it('includes 2A0', () => {
    expect(PageSizes['2A0']).toEqual([3370.39, 4767.87]);
  });
  it('includes A7', () => {
    expect(PageSizes.A7).toEqual([209.76, 297.64]);
  });
  it('includes A8', () => {
    expect(PageSizes.A8).toEqual([147.40, 209.76]);
  });
  it('includes A9', () => {
    expect(PageSizes.A9).toEqual([104.88, 147.40]);
  });
  it('includes A10', () => {
    expect(PageSizes.A10).toEqual([73.70, 104.88]);
  });

  // ISO B series
  it('includes B0', () => {
    expect(PageSizes.B0).toEqual([2834.65, 4008.19]);
  });
  it('includes B1', () => {
    expect(PageSizes.B1).toEqual([2004.09, 2834.65]);
  });
  it('includes B2', () => {
    expect(PageSizes.B2).toEqual([1417.32, 2004.09]);
  });
  it('includes B3', () => {
    expect(PageSizes.B3).toEqual([1000.63, 1417.32]);
  });
  it('includes B6', () => {
    expect(PageSizes.B6).toEqual([354.33, 498.90]);
  });
  it('includes B7', () => {
    expect(PageSizes.B7).toEqual([249.45, 354.33]);
  });
  it('includes B8', () => {
    expect(PageSizes.B8).toEqual([175.75, 249.45]);
  });
  it('includes B9', () => {
    expect(PageSizes.B9).toEqual([124.72, 175.75]);
  });
  it('includes B10', () => {
    expect(PageSizes.B10).toEqual([87.87, 124.72]);
  });

  // US
  it('includes Folio', () => {
    expect(PageSizes.Folio).toEqual([612, 936]);
  });

  // Existing sizes still present
  it('still has A4', () => {
    expect(PageSizes.A4).toEqual([595.28, 841.89]);
  });
  it('still has Letter', () => {
    expect(PageSizes.Letter).toEqual([612, 792]);
  });
});
