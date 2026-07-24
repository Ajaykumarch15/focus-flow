export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  let hx = (hex || '#0ea5e9').trim().replace('#', '');
  if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
  if (hx.length !== 6) hx = '0ea5e9';
  const num = parseInt(hx, 16);
  if (isNaN(num)) return { h: 199, s: 89, l: 48 };

  r = (num >> 16) & 255;
  g = (num >> 8) & 255;
  b = num & 255;

  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
  else if (max === gf) h = ((bf - rf) / d + 2) / 6;
  else h = ((rf - gf) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function HSLToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const DARK_MODE_LIGHTNESS: Record<string, number> = {
  '50': 97, '100': 92, '200': 82, '300': 68,
  '400': 55, '600': 39, '700': 30, '800': 22, '900': 16,
};

const LIGHT_MODE_LIGHTNESS: Record<string, number> = {
  '50': 95, '100': 88, '200': 78, '300': 58,
  '400': 45, '600': 35, '700': 27, '800': 19, '900': 12,
};

function buildShades(
  h: number,
  s: number,
  baseL: number,
  levels: Record<string, number>,
): Record<string, string> {
  const shades: Record<string, string> = {};
  for (const [key, targetL] of Object.entries(levels)) {
    const num = parseInt(key);
    const sat = Math.min(s, num >= 600 ? s - 10 : num <= 200 ? s - 15 : s);
    shades[key] = HSLToHex(h, Math.max(40, sat), targetL);
  }
  return shades;
}

export function generateBrandShades(hex: string, mode: 'dark' | 'light' = 'dark'): Record<string, string> {
  const { h, s, l } = hexToHSL(hex);
  const baseL = mode === 'light' ? Math.max(38, l - 3) : l;
  const levels = mode === 'light' ? LIGHT_MODE_LIGHTNESS : DARK_MODE_LIGHTNESS;
  const shades = buildShades(h, s, baseL, levels);
  shades['500'] = HSLToHex(h, Math.max(40, s), baseL);
  return shades;
}
