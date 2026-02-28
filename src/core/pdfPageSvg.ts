/**
 * @module core/pdfPageSvg
 *
 * Pure functions for converting SVG path commands to PDF content-stream
 * operators.  Extracted from {@link pdfPage} to keep the PdfPage class
 * focused on page-level drawing logic.
 */

import type { SvgDrawCommand } from '../assets/svg/svgParser.js';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** Format a number for PDF output. */
export function fmtN(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Magic constant for circular arc approximation: 4*(sqrt(2)-1)/3. */
export const KAPPA = 0.5522847498;

// ---------------------------------------------------------------------------
// SVG arc → PDF Bezier curves
// ---------------------------------------------------------------------------

/**
 * Approximate an SVG arc command as cubic Bezier curve(s) (PDF operators).
 *
 * SVG arcs use endpoint parameterization; PDF has no native arc command.
 */
export function svgArcToPdfOps(
  fromX: number, fromY: number,
  rx0: number, ry0: number,
  rotationDeg: number, largeArcFlag: number, sweepFlag: number,
  toX: number, toY: number,
): string {
  let rx = Math.abs(rx0);
  let ry = Math.abs(ry0);
  if (rx === 0 || ry === 0) return `${fmtN(toX)} ${fmtN(toY)} l\n`;

  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (fromX - toX) / 2;
  const dy2 = (fromY - toY) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s; ry *= s; rxSq = rx * rx; rySq = ry * ry;
  }

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) /
           (rxSq * y1pSq + rySq * x1pSq);
  if (sq < 0) sq = 0;
  sq = Math.sqrt(sq);
  if (largeArcFlag === sweepFlag) sq = -sq;

  const cxp = sq * rx * y1p / ry;
  const cyp = -sq * ry * x1p / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (fromX + toX) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (fromY + toY) / 2;

  function vecAngle(ux: number, uy: number, vx: number, vy: number): number {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    let r = (ux * vx + uy * vy) / (Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy));
    if (r < -1) r = -1; if (r > 1) r = 1;
    return sign * Math.acos(r);
  }

  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vecAngle(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry,
  );
  if (sweepFlag === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  const segs = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const segAngle = dTheta / segs;
  let ops = '';
  let angle = theta1;
  for (let i = 0; i < segs; i++) {
    const a1 = angle;
    const a2 = angle + segAngle;
    const alpha = (4 / 3) * Math.tan((a2 - a1) / 4);
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
    const ep1x = cosPhi * rx * cos1 - sinPhi * ry * sin1 + cx;
    const ep1y = sinPhi * rx * cos1 + cosPhi * ry * sin1 + cy;
    const cp1x = ep1x + alpha * (-cosPhi * rx * sin1 - sinPhi * ry * cos1);
    const cp1y = ep1y + alpha * (-sinPhi * rx * sin1 + cosPhi * ry * cos1);
    const ep2x = cosPhi * rx * cos2 - sinPhi * ry * sin2 + cx;
    const ep2y = sinPhi * rx * cos2 + cosPhi * ry * sin2 + cy;
    const cp2x = ep2x - alpha * (-cosPhi * rx * sin2 - sinPhi * ry * cos2);
    const cp2y = ep2y - alpha * (-sinPhi * rx * sin2 + cosPhi * ry * cos2);
    ops += `${fmtN(cp1x)} ${fmtN(cp1y)} ${fmtN(cp2x)} ${fmtN(cp2y)} ${fmtN(ep2x)} ${fmtN(ep2y)} c\n`;
    angle = a2;
  }
  return ops;
}

// ---------------------------------------------------------------------------
// SVG commands → PDF path operators
// ---------------------------------------------------------------------------

/**
 * Convert parsed SVG draw commands into PDF path construction operators.
 *
 * Does **not** emit painting operators (fill / stroke) -- the caller
 * is responsible for that.
 */
export function svgCommandsToPdfOps(commands: SvgDrawCommand[]): string {
  let ops = '';
  let curX = 0;
  let curY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'moveTo':
        curX = cmd.params[0]!;
        curY = cmd.params[1]!;
        ops += `${fmtN(curX)} ${fmtN(curY)} m\n`;
        break;

      case 'lineTo':
        curX = cmd.params[0]!;
        curY = cmd.params[1]!;
        ops += `${fmtN(curX)} ${fmtN(curY)} l\n`;
        break;

      case 'curveTo':
        ops += `${fmtN(cmd.params[0]!)} ${fmtN(cmd.params[1]!)} ${fmtN(cmd.params[2]!)} ${fmtN(cmd.params[3]!)} ${fmtN(cmd.params[4]!)} ${fmtN(cmd.params[5]!)} c\n`;
        curX = cmd.params[4]!;
        curY = cmd.params[5]!;
        break;

      case 'quadCurveTo': {
        // Convert quadratic Bezier to cubic Bezier
        const cpx = cmd.params[0]!;
        const cpy = cmd.params[1]!;
        const toX = cmd.params[2]!;
        const toY = cmd.params[3]!;
        const cp1x = curX + (2 / 3) * (cpx - curX);
        const cp1y = curY + (2 / 3) * (cpy - curY);
        const cp2x = toX + (2 / 3) * (cpx - toX);
        const cp2y = toY + (2 / 3) * (cpy - toY);
        ops += `${fmtN(cp1x)} ${fmtN(cp1y)} ${fmtN(cp2x)} ${fmtN(cp2y)} ${fmtN(toX)} ${fmtN(toY)} c\n`;
        curX = toX;
        curY = toY;
        break;
      }

      case 'closePath':
        ops += 'h\n';
        break;

      case 'rect':
        ops += `${fmtN(cmd.params[0]!)} ${fmtN(cmd.params[1]!)} ${fmtN(cmd.params[2]!)} ${fmtN(cmd.params[3]!)} re\n`;
        break;

      case 'circle': {
        const ccx = cmd.params[0]!, ccy = cmd.params[1]!, r = cmd.params[2]!;
        const ox = r * KAPPA, oy = r * KAPPA;
        ops += `${fmtN(ccx)} ${fmtN(ccy + r)} m\n`;
        ops += `${fmtN(ccx + ox)} ${fmtN(ccy + r)} ${fmtN(ccx + r)} ${fmtN(ccy + oy)} ${fmtN(ccx + r)} ${fmtN(ccy)} c\n`;
        ops += `${fmtN(ccx + r)} ${fmtN(ccy - oy)} ${fmtN(ccx + ox)} ${fmtN(ccy - r)} ${fmtN(ccx)} ${fmtN(ccy - r)} c\n`;
        ops += `${fmtN(ccx - ox)} ${fmtN(ccy - r)} ${fmtN(ccx - r)} ${fmtN(ccy - oy)} ${fmtN(ccx - r)} ${fmtN(ccy)} c\n`;
        ops += `${fmtN(ccx - r)} ${fmtN(ccy + oy)} ${fmtN(ccx - ox)} ${fmtN(ccy + r)} ${fmtN(ccx)} ${fmtN(ccy + r)} c\n`;
        break;
      }

      case 'ellipse': {
        const ecx = cmd.params[0]!, ecy = cmd.params[1]!;
        const erx = cmd.params[2]!, ery = cmd.params[3]!;
        const eox = erx * KAPPA, eoy = ery * KAPPA;
        ops += `${fmtN(ecx)} ${fmtN(ecy + ery)} m\n`;
        ops += `${fmtN(ecx + eox)} ${fmtN(ecy + ery)} ${fmtN(ecx + erx)} ${fmtN(ecy + eoy)} ${fmtN(ecx + erx)} ${fmtN(ecy)} c\n`;
        ops += `${fmtN(ecx + erx)} ${fmtN(ecy - eoy)} ${fmtN(ecx + eox)} ${fmtN(ecy - ery)} ${fmtN(ecx)} ${fmtN(ecy - ery)} c\n`;
        ops += `${fmtN(ecx - eox)} ${fmtN(ecy - ery)} ${fmtN(ecx - erx)} ${fmtN(ecy - eoy)} ${fmtN(ecx - erx)} ${fmtN(ecy)} c\n`;
        ops += `${fmtN(ecx - erx)} ${fmtN(ecy + eoy)} ${fmtN(ecx - eox)} ${fmtN(ecy + ery)} ${fmtN(ecx)} ${fmtN(ecy + ery)} c\n`;
        break;
      }

      case 'arc':
        ops += svgArcToPdfOps(
          curX, curY,
          cmd.params[0]!, cmd.params[1]!, cmd.params[2]!,
          cmd.params[3]!, cmd.params[4]!,
          cmd.params[5]!, cmd.params[6]!,
        );
        curX = cmd.params[5]!;
        curY = cmd.params[6]!;
        break;
    }
  }

  return ops;
}
