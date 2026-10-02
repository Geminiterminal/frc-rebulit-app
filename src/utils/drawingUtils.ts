import { DrawingPoint } from '../types/scouting';

/**
 * Converts an array of percentage-based points (0-100) to a smooth Quadratic Bézier SVG path string
 * for 500x1000 viewBox. Uses midpoint interpolation for silky smooth curves.
 */
export const pointsToSmoothSvgPath = (pts: DrawingPoint[]): string => {
  if (!pts || pts.length === 0) return '';
  
  if (pts.length === 1) {
    const sx = (pts[0].x / 100) * 500;
    const sy = (pts[0].y / 100) * 1000;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${sx.toFixed(1)} ${sy.toFixed(1)}`;
  }
  
  if (pts.length === 2) {
    const p0x = (pts[0].x / 100) * 500;
    const p0y = (pts[0].y / 100) * 1000;
    const p1x = (pts[1].x / 100) * 500;
    const p1y = (pts[1].y / 100) * 1000;
    return `M ${p0x.toFixed(1)} ${p0y.toFixed(1)} L ${p1x.toFixed(1)} ${p1y.toFixed(1)}`;
  }

  const p0x = (pts[0].x / 100) * 500;
  const p0y = (pts[0].y / 100) * 1000;
  let d = `M ${p0x.toFixed(1)} ${p0y.toFixed(1)}`;

  for (let i = 1; i < pts.length - 1; i++) {
    const currX = (pts[i].x / 100) * 500;
    const currY = (pts[i].y / 100) * 1000;
    const nextX = (pts[i + 1].x / 100) * 500;
    const nextY = (pts[i + 1].y / 100) * 1000;
    const midX = (currX + nextX) / 2;
    const midY = (currY + nextY) / 2;
    d += ` Q ${currX.toFixed(1)} ${currY.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }

  const last = pts[pts.length - 1];
  const lx = (last.x / 100) * 500;
  const ly = (last.y / 100) * 1000;
  d += ` L ${lx.toFixed(1)} ${ly.toFixed(1)}`;
  return d;
};
