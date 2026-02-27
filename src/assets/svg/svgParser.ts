/**
 * @module assets/svg/svgParser
 *
 * Parse SVG XML into an intermediate representation of drawing commands.
 *
 * This parser uses a simple regex / state-machine approach (no DOMParser)
 * so that it works in every JavaScript runtime (Node, Deno, Bun,
 * Cloudflare Workers, browsers).
 *
 * Supported SVG elements:
 * `<svg>`, `<g>`, `<path>`, `<rect>`, `<circle>`, `<ellipse>`,
 * `<line>`, `<polyline>`, `<polygon>`, `<text>` (basic).
 *
 * Supported path commands:
 * M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single drawing command produced from an SVG element. */
export interface SvgDrawCommand {
  type:
    | 'moveTo'
    | 'lineTo'
    | 'curveTo'
    | 'quadCurveTo'
    | 'closePath'
    | 'rect'
    | 'circle'
    | 'ellipse'
    | 'arc';
  params: number[];
}

/** Parsed representation of an SVG element. */
export interface SvgElement {
  tag: string;
  attributes: Record<string, string>;
  children: SvgElement[];
  commands?: SvgDrawCommand[] | undefined;
  fill?: { r: number; g: number; b: number; a?: number | undefined } | undefined;
  stroke?: { r: number; g: number; b: number; a?: number | undefined } | undefined;
  strokeWidth?: number | undefined;
  transform?: [number, number, number, number, number, number] | undefined;
  opacity?: number | undefined;
}

// ---------------------------------------------------------------------------
// Named SVG colours (basic set)
// ---------------------------------------------------------------------------

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black:   [0, 0, 0],
  white:   [255, 255, 255],
  red:     [255, 0, 0],
  green:   [0, 128, 0],
  blue:    [0, 0, 255],
  yellow:  [255, 255, 0],
  cyan:    [0, 255, 255],
  magenta: [255, 0, 255],
  orange:  [255, 165, 0],
  purple:  [128, 0, 128],
  pink:    [255, 192, 203],
  gray:    [128, 128, 128],
  grey:    [128, 128, 128],
  lime:    [0, 255, 0],
  maroon:  [128, 0, 0],
  navy:    [0, 0, 128],
  olive:   [128, 128, 0],
  teal:    [0, 128, 128],
  aqua:    [0, 255, 255],
  fuchsia: [255, 0, 255],
  silver:  [192, 192, 192],
  brown:   [165, 42, 42],
  coral:   [255, 127, 80],
  gold:    [255, 215, 0],
  indigo:  [75, 0, 130],
  violet:  [238, 130, 238],
  salmon:  [250, 128, 114],
  tan:     [210, 180, 140],
  khaki:   [240, 230, 140],
  crimson: [220, 20, 60],
  tomato:  [255, 99, 71],
  chocolate: [210, 105, 30],
  darkblue:  [0, 0, 139],
  darkgreen: [0, 100, 0],
  darkred:   [139, 0, 0],
  darkgray:  [169, 169, 169],
  darkgrey:  [169, 169, 169],
  lightblue:  [173, 216, 230],
  lightgreen: [144, 238, 144],
  lightgray:  [211, 211, 211],
  lightgrey:  [211, 211, 211],
  transparent: [0, 0, 0],  // alpha = 0 handled separately
};

// ---------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------

/**
 * Parse an SVG colour string into an RGB object.
 *
 * Supported formats:
 * - `#rgb`
 * - `#rrggbb`
 * - `rgb(r, g, b)` (0-255)
 * - `rgba(r, g, b, a)` (a: 0-1)
 * - Named colours (basic set)
 *
 * @returns  RGB values (0-255) or `undefined` if not parseable.
 */
export function parseSvgColor(
  colorStr: string,
): { r: number; g: number; b: number; a?: number | undefined } | undefined {
  if (!colorStr) return undefined;

  const s = colorStr.trim().toLowerCase();

  if (s === 'none' || s === 'transparent') {
    return undefined;
  }

  // #rrggbb
  if (s.length === 7 && s[0] === '#') {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return { r, g, b };
    }
  }

  // #rgb
  if (s.length === 4 && s[0] === '#') {
    const r = parseInt(s[1]! + s[1]!, 16);
    const g = parseInt(s[2]! + s[2]!, 16);
    const b = parseInt(s[3]! + s[3]!, 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return { r, g, b };
    }
  }

  // rgba(r, g, b, a)
  const rgbaMatch = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/\s]\s*([\d.]+))?\s*\)$/.exec(s);
  if (rgbaMatch) {
    const r = Math.round(parseFloat(rgbaMatch[1]!));
    const g = Math.round(parseFloat(rgbaMatch[2]!));
    const b = Math.round(parseFloat(rgbaMatch[3]!));
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : undefined;
    return { r, g, b, ...(a !== undefined ? { a } : {}) };
  }

  // Named colour
  const named = NAMED_COLORS[s];
  if (named) {
    return { r: named[0], g: named[1], b: named[2] };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Transform parsing
// ---------------------------------------------------------------------------

/**
 * Parse an SVG `transform` attribute into a 2D affine matrix.
 *
 * Returns `[a, b, c, d, e, f]` representing:
 * ```
 * [ a  c  e ]
 * [ b  d  f ]
 * [ 0  0  1 ]
 * ```
 *
 * Supports: `matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`.
 * Multiple transforms are composed left-to-right.
 */
export function parseSvgTransform(
  transformStr: string,
): [number, number, number, number, number, number] {
  let result: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(transformStr)) !== null) {
    const fn = match[1]!.toLowerCase();
    const args = match[2]!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    let m: [number, number, number, number, number, number];

    switch (fn) {
      case 'matrix':
        m = [
          args[0] ?? 1,
          args[1] ?? 0,
          args[2] ?? 0,
          args[3] ?? 1,
          args[4] ?? 0,
          args[5] ?? 0,
        ];
        break;

      case 'translate': {
        const tx = args[0] ?? 0;
        const ty = args[1] ?? 0;
        m = [1, 0, 0, 1, tx, ty];
        break;
      }

      case 'scale': {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        m = [sx, 0, 0, sy, 0, 0];
        break;
      }

      case 'rotate': {
        const deg = args[0] ?? 0;
        const cx = args[1] ?? 0;
        const cy = args[2] ?? 0;
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        if (cx === 0 && cy === 0) {
          m = [cos, sin, -sin, cos, 0, 0];
        } else {
          // translate(cx,cy) * rotate(deg) * translate(-cx,-cy)
          m = [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
        }
        break;
      }

      case 'skewx': {
        const rad = ((args[0] ?? 0) * Math.PI) / 180;
        m = [1, 0, Math.tan(rad), 1, 0, 0];
        break;
      }

      case 'skewy': {
        const rad = ((args[0] ?? 0) * Math.PI) / 180;
        m = [1, Math.tan(rad), 0, 1, 0, 0];
        break;
      }

      default:
        continue;
    }

    result = multiplyMatrices(result, m);
  }

  return result;
}

/** Multiply two 2D affine matrices represented as [a,b,c,d,e,f]. */
function multiplyMatrices(
  a: [number, number, number, number, number, number],
  b: [number, number, number, number, number, number],
): [number, number, number, number, number, number] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

// ---------------------------------------------------------------------------
// SVG path `d` attribute parsing
// ---------------------------------------------------------------------------

/**
 * Parse an SVG path `d` attribute string into an array of drawing commands.
 *
 * Supports all SVG path commands (absolute and relative):
 * M, L, H, V, C, S, Q, T, A, Z.
 */
export function parseSvgPath(d: string): SvgDrawCommand[] {
  const commands: SvgDrawCommand[] = [];
  if (!d) return commands;

  // Tokenize: split into command letters and numbers
  const tokens: (string | number)[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(d)) !== null) {
    if (m[1] !== undefined) {
      tokens.push(m[1]);
    } else if (m[2] !== undefined) {
      tokens.push(parseFloat(m[2]));
    }
  }

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let prevCmd = '';
  let prevCpX = 0; // previous control point for S/T
  let prevCpY = 0;

  let i = 0;

  function nextNum(): number {
    while (i < tokens.length && typeof tokens[i] === 'string') i++;
    const v = tokens[i];
    i++;
    return typeof v === 'number' ? v : 0;
  }

  function nextFlag(): number {
    // Flags in arc commands can be 0 or 1 and may be adjacent without separator
    while (i < tokens.length && typeof tokens[i] === 'string') i++;
    const v = tokens[i];
    i++;
    return typeof v === 'number' ? v : 0;
  }

  while (i < tokens.length) {
    const token = tokens[i];

    if (typeof token === 'string') {
      prevCmd = token;
      i++;
    }

    const cmd = prevCmd;

    switch (cmd) {
      case 'M': {
        const x = nextNum();
        const y = nextNum();
        curX = x;
        curY = y;
        startX = x;
        startY = y;
        commands.push({ type: 'moveTo', params: [x, y] });
        // Subsequent coordinate pairs are treated as L
        prevCmd = 'L';
        break;
      }

      case 'm': {
        const dx = nextNum();
        const dy = nextNum();
        curX += dx;
        curY += dy;
        startX = curX;
        startY = curY;
        commands.push({ type: 'moveTo', params: [curX, curY] });
        prevCmd = 'l';
        break;
      }

      case 'L': {
        const x = nextNum();
        const y = nextNum();
        curX = x;
        curY = y;
        commands.push({ type: 'lineTo', params: [x, y] });
        break;
      }

      case 'l': {
        const dx = nextNum();
        const dy = nextNum();
        curX += dx;
        curY += dy;
        commands.push({ type: 'lineTo', params: [curX, curY] });
        break;
      }

      case 'H': {
        const x = nextNum();
        curX = x;
        commands.push({ type: 'lineTo', params: [curX, curY] });
        break;
      }

      case 'h': {
        const dx = nextNum();
        curX += dx;
        commands.push({ type: 'lineTo', params: [curX, curY] });
        break;
      }

      case 'V': {
        const y = nextNum();
        curY = y;
        commands.push({ type: 'lineTo', params: [curX, curY] });
        break;
      }

      case 'v': {
        const dy = nextNum();
        curY += dy;
        commands.push({ type: 'lineTo', params: [curX, curY] });
        break;
      }

      case 'C': {
        const x1 = nextNum();
        const y1 = nextNum();
        const x2 = nextNum();
        const y2 = nextNum();
        const x = nextNum();
        const y = nextNum();
        commands.push({ type: 'curveTo', params: [x1, y1, x2, y2, x, y] });
        prevCpX = x2;
        prevCpY = y2;
        curX = x;
        curY = y;
        break;
      }

      case 'c': {
        const dx1 = nextNum();
        const dy1 = nextNum();
        const dx2 = nextNum();
        const dy2 = nextNum();
        const dx = nextNum();
        const dy = nextNum();
        const x1 = curX + dx1;
        const y1 = curY + dy1;
        const x2 = curX + dx2;
        const y2 = curY + dy2;
        curX += dx;
        curY += dy;
        commands.push({ type: 'curveTo', params: [x1, y1, x2, y2, curX, curY] });
        prevCpX = x2;
        prevCpY = y2;
        break;
      }

      case 'S': {
        // Smooth cubic: reflect previous control point
        let x1: number, y1: number;
        if (/[CcSs]/.test(prevCmd)) {
          x1 = 2 * curX - prevCpX;
          y1 = 2 * curY - prevCpY;
        } else {
          x1 = curX;
          y1 = curY;
        }
        const x2 = nextNum();
        const y2 = nextNum();
        const x = nextNum();
        const y = nextNum();
        commands.push({ type: 'curveTo', params: [x1, y1, x2, y2, x, y] });
        prevCpX = x2;
        prevCpY = y2;
        curX = x;
        curY = y;
        prevCmd = 'S';
        break;
      }

      case 's': {
        let x1: number, y1: number;
        if (/[CcSs]/.test(prevCmd)) {
          x1 = 2 * curX - prevCpX;
          y1 = 2 * curY - prevCpY;
        } else {
          x1 = curX;
          y1 = curY;
        }
        const dx2 = nextNum();
        const dy2 = nextNum();
        const dx = nextNum();
        const dy = nextNum();
        const x2 = curX + dx2;
        const y2 = curY + dy2;
        curX += dx;
        curY += dy;
        commands.push({ type: 'curveTo', params: [x1, y1, x2, y2, curX, curY] });
        prevCpX = x2;
        prevCpY = y2;
        prevCmd = 's';
        break;
      }

      case 'Q': {
        const x1 = nextNum();
        const y1 = nextNum();
        const x = nextNum();
        const y = nextNum();
        commands.push({ type: 'quadCurveTo', params: [x1, y1, x, y] });
        prevCpX = x1;
        prevCpY = y1;
        curX = x;
        curY = y;
        break;
      }

      case 'q': {
        const dx1 = nextNum();
        const dy1 = nextNum();
        const dx = nextNum();
        const dy = nextNum();
        const x1 = curX + dx1;
        const y1 = curY + dy1;
        curX += dx;
        curY += dy;
        commands.push({ type: 'quadCurveTo', params: [x1, y1, curX, curY] });
        prevCpX = x1;
        prevCpY = y1;
        break;
      }

      case 'T': {
        let x1: number, y1: number;
        if (/[QqTt]/.test(prevCmd)) {
          x1 = 2 * curX - prevCpX;
          y1 = 2 * curY - prevCpY;
        } else {
          x1 = curX;
          y1 = curY;
        }
        const x = nextNum();
        const y = nextNum();
        commands.push({ type: 'quadCurveTo', params: [x1, y1, x, y] });
        prevCpX = x1;
        prevCpY = y1;
        curX = x;
        curY = y;
        prevCmd = 'T';
        break;
      }

      case 't': {
        let x1: number, y1: number;
        if (/[QqTt]/.test(prevCmd)) {
          x1 = 2 * curX - prevCpX;
          y1 = 2 * curY - prevCpY;
        } else {
          x1 = curX;
          y1 = curY;
        }
        const dx = nextNum();
        const dy = nextNum();
        curX += dx;
        curY += dy;
        commands.push({ type: 'quadCurveTo', params: [x1, y1, curX, curY] });
        prevCpX = x1;
        prevCpY = y1;
        prevCmd = 't';
        break;
      }

      case 'A':
      case 'a': {
        const rx = nextNum();
        const ry = nextNum();
        const rotation = nextNum();
        const largeArc = nextFlag();
        const sweep = nextFlag();
        const rawX = nextNum();
        const rawY = nextNum();
        const x = cmd === 'A' ? rawX : curX + rawX;
        const y = cmd === 'A' ? rawY : curY + rawY;
        commands.push({
          type: 'arc',
          params: [rx, ry, rotation, largeArc, sweep, x, y],
        });
        curX = x;
        curY = y;
        break;
      }

      case 'Z':
      case 'z':
        commands.push({ type: 'closePath', params: [] });
        curX = startX;
        curY = startY;
        break;

      default:
        // Unknown command, skip
        i++;
        break;
    }
  }

  return commands;
}

// ---------------------------------------------------------------------------
// XML parsing helpers
// ---------------------------------------------------------------------------

/** Parse attributes from an opening tag string like `<tag attr="val" ...>`. */
function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w\-:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]!] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

/** Simple XML tokenizer that yields open tags, close tags, and text. */
interface XmlToken {
  type: 'open' | 'close' | 'selfclose' | 'text';
  tag?: string | undefined;
  attrs?: Record<string, string> | undefined;
  text?: string | undefined;
}

function* tokenizeXml(xml: string): Generator<XmlToken> {
  // Remove XML comments and processing instructions
  const cleaned = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  const re = /<\s*\/\s*([\w\-:]+)\s*>|<\s*([\w\-:]+)((?:\s+[\w\-:]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(cleaned)) !== null) {
    if (m[1] !== undefined) {
      // Closing tag
      yield { type: 'close', tag: m[1].toLowerCase() };
    } else if (m[2] !== undefined) {
      const tag = m[2].toLowerCase();
      const attrs = parseAttributes(m[3] ?? '');
      if (m[4] === '/') {
        yield { type: 'selfclose', tag, attrs };
      } else {
        yield { type: 'open', tag, attrs };
      }
    } else if (m[5] !== undefined) {
      const text = m[5].trim();
      if (text) {
        yield { type: 'text', text };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Element parsing
// ---------------------------------------------------------------------------

/** Parse a numeric attribute, returning `defaultVal` if missing or NaN. */
function numAttr(attrs: Record<string, string>, name: string, defaultVal: number = 0): number {
  const v = attrs[name];
  if (v === undefined) return defaultVal;
  const n = parseFloat(v);
  return isNaN(n) ? defaultVal : n;
}

/** Generate drawing commands for a <rect> element. */
function rectCommands(attrs: Record<string, string>): SvgDrawCommand[] {
  const x = numAttr(attrs, 'x');
  const y = numAttr(attrs, 'y');
  const w = numAttr(attrs, 'width');
  const h = numAttr(attrs, 'height');
  const rx = numAttr(attrs, 'rx');
  const ry = numAttr(attrs, 'ry', rx);

  if (rx > 0 || ry > 0) {
    // Rounded rect as path commands
    const r = Math.min(rx, w / 2);
    const ry2 = Math.min(ry, h / 2);
    return [
      { type: 'moveTo', params: [x + r, y] },
      { type: 'lineTo', params: [x + w - r, y] },
      { type: 'arc', params: [r, ry2, 0, 0, 1, x + w, y + ry2] },
      { type: 'lineTo', params: [x + w, y + h - ry2] },
      { type: 'arc', params: [r, ry2, 0, 0, 1, x + w - r, y + h] },
      { type: 'lineTo', params: [x + r, y + h] },
      { type: 'arc', params: [r, ry2, 0, 0, 1, x, y + h - ry2] },
      { type: 'lineTo', params: [x, y + ry2] },
      { type: 'arc', params: [r, ry2, 0, 0, 1, x + r, y] },
      { type: 'closePath', params: [] },
    ];
  }

  return [{ type: 'rect', params: [x, y, w, h] }];
}

/** Generate drawing commands for a <circle> element. */
function circleCommands(attrs: Record<string, string>): SvgDrawCommand[] {
  const cx = numAttr(attrs, 'cx');
  const cy = numAttr(attrs, 'cy');
  const r = numAttr(attrs, 'r');
  return [{ type: 'circle', params: [cx, cy, r] }];
}

/** Generate drawing commands for an <ellipse> element. */
function ellipseCommands(attrs: Record<string, string>): SvgDrawCommand[] {
  const cx = numAttr(attrs, 'cx');
  const cy = numAttr(attrs, 'cy');
  const rx = numAttr(attrs, 'rx');
  const ry = numAttr(attrs, 'ry');
  return [{ type: 'ellipse', params: [cx, cy, rx, ry] }];
}

/** Generate drawing commands for a <line> element. */
function lineCommands(attrs: Record<string, string>): SvgDrawCommand[] {
  const x1 = numAttr(attrs, 'x1');
  const y1 = numAttr(attrs, 'y1');
  const x2 = numAttr(attrs, 'x2');
  const y2 = numAttr(attrs, 'y2');
  return [
    { type: 'moveTo', params: [x1, y1] },
    { type: 'lineTo', params: [x2, y2] },
  ];
}

/** Parse a space/comma-separated list of numbers. */
function parseNumberList(str: string): number[] {
  return str
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n));
}

/** Generate drawing commands for a <polyline> element. */
function polylineCommands(attrs: Record<string, string>): SvgDrawCommand[] {
  const points = parseNumberList(attrs['points'] ?? '');
  const cmds: SvgDrawCommand[] = [];
  for (let i = 0; i < points.length - 1; i += 2) {
    if (i === 0) {
      cmds.push({ type: 'moveTo', params: [points[i]!, points[i + 1]!] });
    } else {
      cmds.push({ type: 'lineTo', params: [points[i]!, points[i + 1]!] });
    }
  }
  return cmds;
}

/** Generate drawing commands for a <polygon> element. */
function polygonCommands(attrs: Record<string, string>): SvgDrawCommand[] {
  const cmds = polylineCommands(attrs);
  if (cmds.length > 0) {
    cmds.push({ type: 'closePath', params: [] });
  }
  return cmds;
}

/** Resolve style and presentation attributes into fill/stroke/etc. */
function resolveStyles(el: SvgElement): void {
  const attrs = el.attributes;

  // Parse inline style attribute
  const style = attrs['style'];
  if (style) {
    const styleProps = style.split(';');
    for (const prop of styleProps) {
      const colonIdx = prop.indexOf(':');
      if (colonIdx >= 0) {
        const key = prop.slice(0, colonIdx).trim().toLowerCase();
        const val = prop.slice(colonIdx + 1).trim();
        if (key && val) {
          // Style overrides attributes
          attrs[key] = val;
        }
      }
    }
  }

  // Fill
  const fillStr = attrs['fill'];
  if (fillStr !== undefined && fillStr !== 'none') {
    const c = parseSvgColor(fillStr);
    if (c) {
      el.fill = c;
    }
  }

  // Stroke
  const strokeStr = attrs['stroke'];
  if (strokeStr !== undefined && strokeStr !== 'none') {
    const c = parseSvgColor(strokeStr);
    if (c) {
      el.stroke = c;
    }
  }

  // Stroke width
  const sw = attrs['stroke-width'];
  if (sw !== undefined) {
    const v = parseFloat(sw);
    if (!isNaN(v)) {
      el.strokeWidth = v;
    }
  }

  // Opacity
  const opStr = attrs['opacity'];
  if (opStr !== undefined) {
    const v = parseFloat(opStr);
    if (!isNaN(v)) {
      el.opacity = v;
    }
  }

  // Fill opacity
  const fillOpStr = attrs['fill-opacity'];
  if (fillOpStr !== undefined && el.fill) {
    const v = parseFloat(fillOpStr);
    if (!isNaN(v)) {
      el.fill = { ...el.fill, a: v };
    }
  }

  // Stroke opacity
  const strokeOpStr = attrs['stroke-opacity'];
  if (strokeOpStr !== undefined && el.stroke) {
    const v = parseFloat(strokeOpStr);
    if (!isNaN(v)) {
      el.stroke = { ...el.stroke, a: v };
    }
  }

  // Transform
  const transformStr = attrs['transform'];
  if (transformStr) {
    el.transform = parseSvgTransform(transformStr);
  }
}

// ---------------------------------------------------------------------------
// Main SVG parser
// ---------------------------------------------------------------------------

/**
 * Parse an SVG string into an {@link SvgElement} tree.
 *
 * The returned element represents the root `<svg>` element (or a
 * synthetic root if the input contains multiple top-level elements).
 */
export function parseSvg(svgString: string): SvgElement {
  const stack: SvgElement[] = [];
  let root: SvgElement | undefined;

  for (const token of tokenizeXml(svgString)) {
    switch (token.type) {
      case 'open': {
        const el: SvgElement = {
          tag: token.tag!,
          attributes: token.attrs ?? {},
          children: [],
        };

        // Generate commands for shape elements
        addCommandsForElement(el);
        resolveStyles(el);

        if (stack.length > 0) {
          stack.at(-1)!.children.push(el);
        }
        stack.push(el);

        root ??= el;
        break;
      }

      case 'selfclose': {
        const el: SvgElement = {
          tag: token.tag!,
          attributes: token.attrs ?? {},
          children: [],
        };

        addCommandsForElement(el);
        resolveStyles(el);

        if (stack.length > 0) {
          stack.at(-1)!.children.push(el);
        }

        root ??= el;
        break;
      }

      case 'close': {
        if (stack.length > 1) {
          stack.pop();
        }
        break;
      }

      case 'text': {
        // Attach text content as a child text node
        if (stack.length > 0) {
          const parent = stack.at(-1)!;
          if (parent.tag === 'text' || parent.tag === 'tspan') {
            parent.attributes['__text'] = token.text ?? '';
          }
        }
        break;
      }
    }
  }

  return root ?? { tag: 'svg', attributes: {}, children: [] };
}

/** Add drawing commands to an element based on its tag name. */
function addCommandsForElement(el: SvgElement): void {
  switch (el.tag) {
    case 'path':
      el.commands = parseSvgPath(el.attributes['d'] ?? '');
      break;
    case 'rect':
      el.commands = rectCommands(el.attributes);
      break;
    case 'circle':
      el.commands = circleCommands(el.attributes);
      break;
    case 'ellipse':
      el.commands = ellipseCommands(el.attributes);
      break;
    case 'line':
      el.commands = lineCommands(el.attributes);
      break;
    case 'polyline':
      el.commands = polylineCommands(el.attributes);
      break;
    case 'polygon':
      el.commands = polygonCommands(el.attributes);
      break;
  }
}
