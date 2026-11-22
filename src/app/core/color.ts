/** OKLCH to sRGB hex (Ottosson's OKLab). WebGL needs plain RGB; CSS uses the same OKLCH values directly. */
function toLinearRgb(L: number, C: number, h: number): [number, number, number] {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const encode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** Out-of-gamut colours lose chroma (hue and lightness kept), as browsers do for CSS oklch(). */
export function oklchToHex(L: number, C: number, h: number): string {
  let rgb = toLinearRgb(L, C, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(toLinearRgb(L, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = toLinearRgb(L, lo, h);
  }
  return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, encode(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
}

/** The course accent used for 3D scenes, matching --accent in light and dark themes. */
export const accentHex = (hue: number, dark: boolean): string => (dark ? oklchToHex(0.74, 0.15, hue) : oklchToHex(0.56, 0.19, hue));
