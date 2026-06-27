import { describe, it, expect } from 'vitest';
import { renderDisplayListToCanvas, type Canvas2DLike } from '../../../src/render/canvas.js';
import type { DisplayList } from '../../../src/render/displayList.js';

/** A recording mock of the subset of CanvasRenderingContext2D we use. */
function mockCtx() {
  const calls: string[] = [];
  let fillStyle = '';
  let strokeStyle = '';
  let lineWidth = 0;
  let font = '';
  const ctx: Canvas2DLike = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    moveTo: (x, y) => calls.push(`moveTo(${x.toFixed(0)},${y.toFixed(0)})`),
    lineTo: (x, y) => calls.push(`lineTo(${x.toFixed(0)},${y.toFixed(0)})`),
    closePath: () => calls.push('closePath'),
    fill: (rule) => calls.push(`fill(${rule ?? ''})`),
    stroke: () => calls.push('stroke'),
    fillRect: (x, y, w, h) => calls.push(`fillRect(${x},${y},${w},${h})`),
    fillText: (t, x, y) => calls.push(`fillText(${t},${x.toFixed(0)},${y.toFixed(0)})`),
    set fillStyle(v: string) {
      fillStyle = v;
      calls.push(`fillStyle=${v}`);
    },
    get fillStyle() {
      return fillStyle;
    },
    set strokeStyle(v: string) {
      strokeStyle = v;
      calls.push(`strokeStyle=${v}`);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set lineWidth(v: number) {
      lineWidth = v;
      calls.push(`lineWidth=${v.toFixed(1)}`);
    },
    get lineWidth() {
      return lineWidth;
    },
    set font(v: string) {
      font = v;
      calls.push(`font=${v}`);
    },
    get font() {
      return font;
    },
  };
  return { ctx, calls };
}

describe('renderDisplayListToCanvas', () => {
  it('replays a fill with the right path, rule, and rgba style (y-flipped)', () => {
    const dl: DisplayList = {
      items: [
        {
          type: 'fill',
          subpaths: [{ points: [10, 10, 90, 10, 90, 90, 10, 90], closed: true }],
          rule: 'evenodd',
          color: [255, 0, 0, 255],
          alpha: 1,
        },
      ],
      width: 100,
      height: 100,
      origin: [0, 0],
    };
    const { ctx, calls } = mockCtx();
    renderDisplayListToCanvas(dl, ctx, { scale: 1 });
    expect(calls).toContain('fillStyle=rgba(255, 0, 0, 1)');
    expect(calls).toContain('beginPath');
    // page (10,10) → pixel (10, 100-10=90)
    expect(calls).toContain('moveTo(10,90)');
    expect(calls).toContain('closePath');
    expect(calls).toContain('fill(evenodd)');
  });

  it('renders text natively via fillText with a scaled font', () => {
    const dl: DisplayList = {
      items: [
        {
          type: 'text',
          text: 'Hi',
          font: 'F1',
          fontSize: 24,
          transform: [24, 0, 0, 24, 72, 700],
          color: [0, 0, 0, 255],
          alpha: 1,
          renderMode: 0,
        },
      ],
      width: 612,
      height: 792,
      origin: [0, 0],
    };
    const { ctx, calls } = mockCtx();
    renderDisplayListToCanvas(dl, ctx, { scale: 1 });
    expect(calls.some((c) => c.startsWith('font='))).toBe(true);
    // baseline at page (72,700) → pixel (72, 792-700=92)
    expect(calls).toContain('fillText(Hi,72,92)');
  });

  it('skips invisible text (render mode 3)', () => {
    const dl: DisplayList = {
      items: [
        {
          type: 'text',
          text: 'secret',
          font: undefined,
          fontSize: 12,
          transform: [12, 0, 0, 12, 0, 0],
          color: [0, 0, 0, 255],
          alpha: 1,
          renderMode: 3,
        },
      ],
      width: 100,
      height: 100,
      origin: [0, 0],
    };
    const { ctx, calls } = mockCtx();
    renderDisplayListToCanvas(dl, ctx, { scale: 1 });
    expect(calls.some((c) => c.startsWith('fillText'))).toBe(false);
  });
});
