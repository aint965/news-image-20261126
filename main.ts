// THE WORLD IN ONE DAY — Thursday 26 November 2026
// A program that draws a newspaper front page summing up the day's world
// news and writes it to /output/entry.png (1024x1024 PNG, deterministic).
// Real serif type: Liberation Serif glyph bitmaps embedded below (rendered
// with PIL at build time). World map: hand-drawn coarse coastline polygons.
// No network, standard library only, two runs byte-identical.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024, H = 1024;
const img = new Uint8Array(W * H * 4);
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAPER = hex("#f8f5ee"), INK = hex("#17150f"), RED = hex("#c8102e"), NAVY = hex("#14243e");
const GOLD = hex("#c9a227"), GRAY = hex("#6d675c"), LINE = hex("#d8d2c4"), CREAM = hex("#fffdf8");

function setPx(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4, ia = 1 - a;
  img[i] = Math.round(c[0] * a + img[i] * ia);
  img[i + 1] = Math.round(c[1] * a + img[i + 1] * ia);
  img[i + 2] = Math.round(c[2] * a + img[i + 2] * ia);
  img[i + 3] = 255;
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB, a = 1): void {
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w)), y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c, a);
}
function fillRectGrad(x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void {
  for (let yy = 0; yy < Math.round(h); yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    const c: RGB = [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
    fillRect(x, y + yy, w, 1, c);
  }
}
function circle(cx: number, cy: number, r: number, c: RGB, a = 1): void {
  const r2 = r * r, x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r), y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r2) setPx(x, y, c, a);
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) setPx(x, y, c, a);
  }
}
function poly(pts: [number, number][], c: RGB, a = 1): void {
  if (pts.length < 3) return;
  let minY = 1e9, maxY = -1e9;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a0 = Math.max(0, Math.ceil(xs[k])), b0 = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = a0; x <= b0; x++) setPx(x, y, c, a);
    }
  }
}
function line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * w / 2, ny = dx / len * w / 2;
  poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c, a);
}
function roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB, a = 1): void {
  fillRect(x + r, y, w - 2 * r, h, c, a); fillRect(x, y + r, w, h - 2 * r, c, a);
  circle(x + r, y + r, r, c, a); circle(x + w - r, y + r, r, c, a);
  circle(x + r, y + h - r, r, c, a); circle(x + w - r, y + h - r, r, c, a);
}
function star(cx: number, cy: number, r: number, c: RGB): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  poly(pts, c);
}

// ---------- PNG encoder (CRC32 + zlib deflate, deterministic) ----------
const CRC_T: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcIn = new Uint8Array(4 + data.length);
  crcIn.set(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc32(crcIn));
  return out;
}
function encodePNG(): Buffer {
  const raw = new Uint8Array(H * (1 + W * 4));
  for (let y = 0; y < H; y++) { raw[y * (1 + W * 4)] = 0; raw.set(img.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1); }
  const comp = deflateSync(raw, { level: 9 });
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(pngChunk("IHDR", ihdr)), Buffer.from(pngChunk("IDAT", comp)),
    Buffer.from(pngChunk("IEND", new Uint8Array(0))),
  ]);
}

// ---------- bitmap font engine (Liberation Serif atlas, box-averaged) ----------
interface Face { name: string; size: number; ascent: number; descent: number; chars: string; sheetW: number; sheetH: number; data: Uint8Array; metrics: number[][]; }
const ATLAS: { faces: { name: string; size: number; ascent: number; descent: number; chars: string; sheetW: number; sheetH: number; data: string; metrics: number[][]; }[] } = JSON.parse(readFileSync(new URL("./glyphs.json", import.meta.url), "utf8"));
const faces: Face[] = ATLAS.faces.map(f => ({ ...f, data: Buffer.from(f.data, "base64") }));
const SB = faces[0], SR = faces[1]; // serif bold, serif regular
function gbit(f: Face, x: number, y: number): number {
  const idx = y * f.sheetW + x;
  return (f.data[idx >> 3] >> (7 - (idx & 7))) & 1;
}
function drawGlyph(f: Face, ch: string, x: number, yTop: number, size: number, c: RGB): number {
  const ci = f.chars.indexOf(ch);
  const m = f.metrics[ci < 0 ? 0 : ci];
  const s = size / f.size;
  if (m[2] === 0) return m[4] * s;
  const [gx, , gw, gh, adv, dx, dy] = m;
  const tw = Math.max(1, Math.round(gw * s)), th = Math.max(1, Math.round(gh * s));
  const ox = Math.round(x + dx * s), oy = Math.round(yTop + dy * s);
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = tx / s, sx1 = (tx + 1) / s, sy0 = ty / s, sy1 = (ty + 1) / s;
      const xa = Math.max(0, Math.floor(sx0)), xb = Math.min(gw, Math.ceil(sx1));
      const ya = Math.max(0, Math.floor(sy0)), yb = Math.min(gh, Math.ceil(sy1));
      let sum = 0, cnt = 0;
      for (let sy = ya; sy < yb; sy++) for (let sx = xa; sx < xb; sx++) { sum += gbit(f, gx + sx, sy); cnt++; }
      const cov = cnt ? sum / cnt : 0;
      if (cov > 0.03) setPx(ox + tx, oy + ty, c, cov);
    }
  }
  return adv * s;
}
function textW(f: Face, text: string, size: number, ls = 0): number {
  let w = 0;
  for (const ch of text) {
    const ci = f.chars.indexOf(ch);
    w += (ci < 0 ? f.metrics[0][4] : f.metrics[ci][4]) * size / f.size + ls;
  }
  return w - (text.length ? ls : 0);
}
function drawText(f: Face, text: string, x: number, yTop: number, size: number, c: RGB, align: "l" | "c" | "r" = "l", ls = 0): number {
  let px = x;
  if (align !== "l") { const w = textW(f, text, size, ls); px = align === "c" ? x - w / 2 : x - w; }
  for (const ch of text) px += drawGlyph(f, ch, px, yTop, size, c) + ls;
  return px;
}
function wrapText(f: Face, text: string, size: number, maxW: number, ls = 0): string[] {
  const words = text.split(" "), lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const t = cur ? cur + " " + wd : wd;
    if (textW(f, t, size, ls) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(f: Face, text: string, x: number, yTop: number, size: number, maxW: number, c: RGB, lh: number, ls = 0): number {
  const lines = wrapText(f, text, size, maxW, ls);
  lines.forEach((ln, i) => drawText(f, ln, x, yTop + i * lh, size, c, "l", ls));
  return lines.length;
}

// ---------- world map: hand-drawn coarse coastline polygons (lon, lat) ----------
const LAND: [number, number][][] = [
[[-168,66],[-162,60],[-155,58],[-150,61],[-140,60],[-135,57],[-130,54],[-126,49],[-124,42],[-121,36],[-117,33],[-112,29],[-109,24],[-105,20],[-97,16],[-93,15],[-90,14],[-86,12],[-83,9],[-80,8],[-78,7],[-80,10],[-83,15],[-86,16],[-88,18],[-87,21],[-90,21],[-91,19],[-94,18],[-97,22],[-97,26],[-94,29],[-90,29],[-85,30],[-81,26],[-80,32],[-76,35],[-74,39],[-71,41],[-69,44],[-66,45],[-62,46],[-58,47],[-54,48],[-56,50],[-58,53],[-62,56],[-66,58],[-70,60],[-75,62],[-80,63],[-85,66],[-90,67],[-95,69],[-105,68],[-115,68],[-125,70],[-135,69],[-145,70],[-155,71],[-162,70],[-168,66]],
[[-55,60],[-48,60],[-42,61],[-40,65],[-32,68],[-25,70],[-20,74],[-25,78],[-35,80],[-48,79],[-55,76],[-58,72],[-55,68],[-53,64],[-55,60]],
[[-79,9],[-77,5],[-75,0],[-78,-3],[-81,-5],[-78,-9],[-75,-15],[-71,-18],[-70,-23],[-70,-30],[-72,-37],[-73,-44],[-74,-50],[-70,-54],[-66,-55],[-68,-51],[-66,-46],[-63,-41],[-59,-36],[-54,-34],[-50,-30],[-45,-24],[-41,-22],[-39,-17],[-35,-9],[-35,-6],[-38,-4],[-43,-2],[-48,0],[-51,4],[-55,6],[-59,8],[-63,10],[-68,11],[-72,12],[-76,10],[-79,9]],
[[-17,15],[-16,20],[-15,25],[-10,30],[-5,33],[0,36],[9,37],[11,34],[15,32],[20,32],[25,31],[30,31],[32,31],[34,28],[35,24],[36,20],[38,18],[40,15],[42,11],[46,11],[51,12],[51,10],[46,5],[42,0],[40,-5],[39,-10],[38,-15],[36,-20],[35,-25],[32,-29],[28,-33],[22,-35],[18,-33],[16,-28],[13,-20],[12,-15],[12,-9],[10,-3],[9,1],[8,4],[4,6],[-2,5],[-8,5],[-13,8],[-16,11],[-17,15]],
[[-9,37],[-9,39],[-9,43],[-4,44],[-2,46],[-4,48],[-1,49],[1,51],[4,53],[8,55],[8,57],[12,58],[18,56],[21,55],[23,58],[26,59],[28,60],[30,61],[30,64],[33,66],[36,66],[40,67],[44,68],[48,68],[52,68],[56,69],[60,69],[64,69],[68,70],[72,71],[76,72],[80,73],[85,74],[90,75],[95,76],[100,77],[105,77],[110,74],[115,73],[120,72],[125,72],[130,71],[135,71],[140,71],[145,71],[150,70],[155,69],[158,66],[160,62],[162,60],[159,56],[156,52],[152,58],[146,59],[142,54],[141,50],[138,46],[135,44],[132,43],[130,41],[127,39],[126,37],[122,37],[120,34],[121,31],[120,28],[118,25],[114,22],[110,20],[108,18],[106,11],[105,9],[103,6],[101,6],[99,8],[97,12],[95,15],[93,17],[91,21],[89,22],[87,21],[85,19],[83,17],[81,15],[80,12],[79,9],[77,8],[76,10],[74,15],[72,19],[70,21],[68,23],[66,25],[63,25],[61,25],[59,24],[57,25],[59,22],[57,20],[55,17],[52,15],[48,14],[45,13],[43,12],[42,15],[40,19],[38,22],[36,25],[35,28],[34,28],[34,31],[36,34],[36,36],[33,36],[30,36],[27,37],[23,36],[22,38],[19,40],[18,40],[16,38],[16,40],[14,42],[12,44],[8,44],[6,43],[3,43],[0,38],[-2,37],[-6,36],[-5,36],[-9,37]],
[// Australia
[114,-22],[114,-30],[115,-34],[118,-35],[124,-33],[129,-32],[132,-32],[135,-35],[137,-35],[140,-38],[145,-38],[150,-37],[153,-32],[153,-27],[150,-23],[146,-19],[142,-15],[142,-11],[137,-12],[135,-15],[132,-12],[130,-13],[126,-14],[122,-17],[118,-20],[114,-22]],
[// New Zealand, North Island
[173,-35],[176,-38],[178,-38],[176,-40],[175,-41],[174,-39],[173,-35]],
[// New Zealand, South Island
[167,-45],[169,-43],[172,-41],[174,-42],[173,-44],[170,-46],[167,-46],[167,-45]],
[// Japan
[130,31],[132,33],[134,34],[137,35],[139,35],[140,37],[141,39],[141,41],[142,42],[143,42],[141,44],[140,45],[139,44],[137,41],[135,39],[133,36],[131,34],[130,31]],
[// United Kingdom
[-5,50],[-3,53],[-5,56],[-3,58],[-1,57],[0,53],[1,51],[-2,50],[-5,50]],
[// Sumatra
[95,5],[98,2],[100,-1],[103,-3],[105,-5],[104,-6],[101,-3],[99,0],[97,3],[95,5]],
[// Java
[105,-6],[108,-7],[111,-7],[114,-8],[114,-9],[111,-8],[108,-8],[105,-7],[105,-6]],
[// Borneo
[109,1],[111,2],[114,4],[117,3],[119,0],[117,-2],[114,-3],[111,-3],[109,-1],[109,1]],
[// New Guinea
[131,-1],[136,-2],[140,-3],[142,-4],[141,-6],[138,-8],[135,-7],[132,-4],[131,-1]],
[// Philippines
[120,18],[122,17],[122,14],[121,11],[120,13],[120,18]],
];

// ---------- map projection + pins ----------
const MAP = { x: 28, y: 218, w: 968, h: 188 };
function proj(lon: number, lat: number): [number, number] {
  return [MAP.x + (lon + 180) / 360 * MAP.w, MAP.y + (83 - lat) / 139 * MAP.h];
}
const RC = { AS: hex("#c25e1e"), EU: hex("#2f5d8a"), NA: hex("#3f7d4e"), LA: hex("#8a6d1f"), ME: hex("#a62b2b"), AF: hex("#6b4fa1"), PA: hex("#1f7a7a") };
interface Pin { n: number; lon: number; lat: number; r: string; dx: number; dy: number; }
const PINS: Pin[] = [
  { n: 1, lon: 47.98, lat: 29.38, r: "ME", dx: -14, dy: -10 },  // Kuwait drone attack
  { n: 2, lon: 4.35, lat: 50.85, r: "EU", dx: 0, dy: 0 },   // EU summit, Brussels
  { n: 3, lon: 126.98, lat: 37.57, r: "AS", dx: 0, dy: 0 }, // Bank of Korea, Seoul
  { n: 4, lon: 106.8, lat: -6.6, r: "AS", dx: 12, dy: 10 },   // Bogor gold mine
  { n: 5, lon: 114.17, lat: 22.32, r: "AS", dx: 0, dy: 0 }, // Hong Kong fire, 1 year on
  { n: 6, lon: 46.68, lat: 24.71, r: "ME", dx: 0, dy: 0 },  // Saudi intercepts missiles, Riyadh
  { n: 7, lon: 56.25, lat: 26.18, r: "ME", dx: 0, dy: 0 },  // IRGC tanker mines, Khasab
  { n: 8, lon: -0.12, lat: 51.5, r: "EU", dx: -20, dy: -10 }, // Brexit-reset treaty, London
  { n: 9, lon: 6.14, lat: 46.2, r: "EU", dx: 2, dy: 16 },    // FIDE Game 3, Geneva
  { n: 10, lon: -74.0, lat: 40.7, r: "NA", dx: 0, dy: 0 },  // Nor'easter, New York
  { n: 11, lon: 103.8, lat: 1.35, r: "AS", dx: 0, dy: 0 },  // Asia shares bounce, Singapore
  { n: 12, lon: 139.7, lat: 35.7, r: "AS", dx: 0, dy: 0 },  // JETRO survey, Tokyo
  { n: 13, lon: 72.9, lat: 19.1, r: "AS", dx: 0, dy: 0 },   // Uber India chief, Mumbai
  { n: 14, lon: 77.2, lat: 28.6, r: "AS", dx: 8, dy: -8 },   // 26/11 anniversary, Delhi
  { n: 15, lon: 105.85, lat: 21.03, r: "AS", dx: 0, dy: 0 },// Vietnam-US trade deal, Hanoi
  { n: 16, lon: 8.68, lat: 50.1, r: "EU", dx: 18, dy: -2 },  // ECB chief pick, Frankfurt
  { n: 17, lon: -0.12, lat: 51.5, r: "EU", dx: 8, dy: -18 }, // London Chess Classic (offset from 8)
  { n: 18, lon: -122.5, lat: 37.6, r: "NA", dx: 0, dy: 0 }, // King tides, Pacifica CA
  { n: 19, lon: -73.3, lat: 41.3, r: "NA", dx: 14, dy: -10 },// US markets shut (offset from 10)
  { n: 20, lon: -99.1, lat: 19.4, r: "LA", dx: 0, dy: 0 },  // Mexico SpaceX talks
  { n: 21, lon: 28.2, lat: -25.7, r: "AF", dx: 0, dy: -12 },// SA producer inflation, Pretoria
  { n: 22, lon: 28.5, lat: -26.4, r: "AF", dx: 12, dy: 8 }, // Rand worst Nov, Johannesburg
  { n: 23, lon: 151.2, lat: -33.9, r: "PA", dx: 0, dy: 0 }, // Virgin Australia strike, Sydney
  { n: 24, lon: 174.8, lat: -36.8, r: "PA", dx: 0, dy: 0 }, // NZ rockpool fines, Auckland
  { n: 25, lon: -74.6, lat: 40.2, r: "NA", dx: -14, dy: 12 },// Macy's parade postponed (B1, offset from 10)
  { n: 26, lon: 125.75, lat: 39.03, r: "AS", dx: -16, dy: -10 },// Kim Jong Un nuclear order (B2), Pyongyang
  { n: 27, lon: 149.1, lat: -35.3, r: "PA", dx: -16, dy: -8 }, // Australia CPI reaction (B8), Canberra
];
function drawMap(): void {
  fillRect(MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, hex("#eef3f6"));
  for (const polyPts of LAND) {
    const px = polyPts.map(([lo, la]) => proj(lo, la));
    poly(px, hex("#c9d8c2"));
    poly(px, hex("#7d8a76"), 0.15);
  }
  // equator + tropics guides
  for (const [lat, c] of [[0, 0.5], [23.4, 0.3], [-23.4, 0.3]] as [number, number][]) {
    const y = proj(0, lat)[1];
    for (let x = MAP.x; x < MAP.x + MAP.w; x += 6) setPx(x, y, hex("#9db4c0"), c);
  }
  // pins
  for (const p of PINS) {
    const [tx, ty] = proj(p.lon, p.lat);
    const px = tx + p.dx, py = ty + p.dy;
    if (p.dx || p.dy) line(tx, ty, px, py, 1, INK, 0.7);
    circle(px, py, 8.5, hex("#ffffff"));
    circle(px, py, 7.2, RC[p.r as keyof typeof RC]);
    drawText(SB, String(p.n), px, py - 6, 11, hex("#ffffff"), "c");
  }
}

// ---------- drawn scene illustrations (lead cards, 312 x 96) ----------
function sceneKuwait(x: number, y: number, w: number, h: number): void {
  fillRectGrad(x, y, w, h, hex("#2b2f3a"), hex("#4a3a2a"));
  fillRect(x, y + h - 26, w, 26, hex("#1a1a1a"));
  fillRect(x + 30, y + 34, 96, 30, hex("#3a3f4a"));
  fillRect(x + 140, y + 26, 84, 38, hex("#333845"));
  fillRect(x + 232, y + 40, 60, 24, hex("#3a3f4a"));
  for (let i = 0; i < 5; i++) fillRect(x + 42 + i * 16, y + 42, 6, 14, hex("#c9a227"), 0.9);
  for (let i = 0; i < 4; i++) fillRect(x + 150 + i * 16, y + 34, 6, 14, hex("#c9a227"), 0.9);
  circle(x + 200, y + 20, 9, hex("#e8b84b"));
  circle(x + 200, y + 20, 14, hex("#e8b84b"), 0.25);
  fillRect(x + 60, y + 8, 3, 14, hex("#d35400")); poly([[x + 60, y + 8], [x + 66, y + 12], [x + 60, y + 16]], hex("#e67e22"));
  fillRect(x + 250, y + 12, 3, 12, hex("#d35400")); poly([[x + 250, y + 12], [x + 256, y + 15], [x + 250, y + 18]], hex("#e67e22"));
}
function sceneSummit(x: number, y: number, w: number, h: number): void {
  fillRectGrad(x, y, w, h, hex("#1e3a5f"), hex("#2f5d8a"));
  fillRect(x, y + h - 20, w, 20, hex("#14243e"));
  ellipse(x + w / 2, y + 62, 120, 26, hex("#d8d2c4"));
  ellipse(x + w / 2, y + 58, 120, 26, hex("#efe9da"));
  for (let i = 0; i < 9; i++) circle(x + 60 + i * 24, y + 52, 4, hex("#c9a227"));
  circle(x + 268, y + 22, 10, hex("#f0e6c8")); circle(x + 268, y + 22, 15, hex("#f0e6c8"), 0.25);
}
function sceneBank(x: number, y: number, w: number, h: number): void {
  fillRectGrad(x, y, w, h, hex("#0f2a1e"), hex("#1e4d33"));
  fillRect(x, y + h - 22, w, 22, hex("#0a1f16"));
  poly([[x + 40, y + 78], [x + 40, y + 30], [x + 90, y + 18], [x + 140, y + 44], [x + 200, y + 26], [x + 260, y + 40]], hex("#c9a227"), 0.9);
  line(x + 40, y + 78, x + 40, y + 30, 2, hex("#e8b84b"));
  line(x + 40, y + 30, x + 90, y + 18, 2, hex("#e8b84b"));
  line(x + 90, y + 18, x + 140, y + 44, 2, hex("#e8b84b"));
  line(x + 140, y + 44, x + 200, y + 26, 2, hex("#e8b84b"));
  line(x + 200, y + 26, x + 260, y + 40, 2, hex("#e8b84b"));
  circle(x + 260, y + 40, 5, hex("#e8b84b"));
  drawText(SB, "+25bp", x + 210, y + 8, 15, hex("#e8b84b"));
  drawText(SR, "3.25%", x + 210, y + 26, 12, hex("#e8f2e8"));
}

// ---------- small thumbnails (56 x 56) for the 8 medium cards ----------
function thMine(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#7a5a33"), hex("#4a3420"));
  poly([[x + 4, y + 56], [x + 20, y + 20], [x + 40, y + 56]], hex("#5a4028"));
  for (const [gx, gy] of [[22, 34], [30, 40], [26, 46], [34, 32]] as [number, number][]) circle(x + gx, y + gy, 2, hex("#e8b84b"));
  circle(x + 28, y + 12, 5, hex("#e8b84b")); circle(x + 28, y + 12, 8, hex("#e8b84b"), 0.3);
}
function thTower(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#2b2f3a"), hex("#4a3a2a"));
  fillRect(x + 18, y + 10, 20, 46, hex("#5a4a3a"));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) fillRect(x + 21 + j * 9, y + 14 + i * 10, 5, 6, hex("#c9a227"), 0.9);
  poly([[x + 28, y + 2], [x + 32, y + 8], [x + 28, y + 12], [x + 24, y + 8]], hex("#e8b84b"));
}
function thChart(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#0f2a1e"), hex("#1e4d33"));
  poly([[x + 6, y + 44], [x + 6, y + 44], [x + 20, y + 30], [x + 32, y + 36], [x + 50, y + 12]], hex("#c9a227"), 0.9);
  line(x + 6, y + 44, x + 20, y + 30, 2, hex("#e8b84b")); line(x + 20, y + 30, x + 32, y + 36, 2, hex("#e8b84b"));
  line(x + 32, y + 36, x + 50, y + 12, 2, hex("#e8b84b"));
  poly([[x + 50, y + 12], [x + 42, y + 12], [x + 50, y + 20]], hex("#e8b84b"));
  circle(x + 50, y + 12, 3, hex("#e8b84b"));
}
function thShield(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#1e3a5f"), hex("#2f5d8a"));
  poly([[x + 14, y + 10], [x + 42, y + 10], [x + 42, y + 28], [x + 28, y + 46], [x + 14, y + 28]], hex("#c9a227"));
  poly([[x + 18, y + 14], [x + 38, y + 14], [x + 38, y + 27], [x + 28, y + 40], [x + 18, y + 27]], hex("#14243e"));
  line(x + 8, y + 16, x + 20, y + 24, 2, hex("#e8f2e8")); line(x + 48, y + 20, x + 36, y + 28, 2, hex("#e8f2e8"));
}
function thShip(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#14243e"), hex("#2f5d8a"));
  fillRect(x, y + 34, 56, 22, hex("#1a3a5f"));
  for (let i = 0; i < 4; i++) fillRect(x + 4 + i * 14, y + 38 + (i % 2) * 4, 10, 2, hex("#7fa8c9"), 0.8);
  poly([[x + 10, y + 34], [x + 46, y + 34], [x + 40, y + 24], [x + 16, y + 24]], hex("#8a6d3f"));
  fillRect(x + 24, y + 14, 4, 12, hex("#d8d2c4"));
  circle(x + 40, y + 14, 4, hex("#17150f")); circle(x + 40, y + 14, 6, hex("#17150f"), 0.35);
  line(x + 36, y + 10, x + 44, y + 18, 1, hex("#17150f")); line(x + 44, y + 10, x + 36, y + 18, 1, hex("#17150f"));
}
function thTreaty(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#eef3f6"), hex("#c9d8e2"));
  fillRect(x + 12, y + 8, 32, 40, hex("#fffdf8"));
  fillRect(x + 12, y + 8, 32, 40, hex("#17150f"), 0.12);
  for (let i = 0; i < 5; i++) fillRect(x + 16, y + 14 + i * 6, 24 - (i % 2) * 6, 2, hex("#2f5d8a"), 0.8);
  circle(x + 40, y + 42, 5, hex("#c8102e")); drawText(SB, "EU", x + 40, y + 39, 6, hex("#ffffff"), "c");
}
function thChess(x: number, y: number): void {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) fillRect(x + c * 14, y + r * 14, 14, 14, (r + c) % 2 ? hex("#efe9da") : hex("#17150f"));
  circle(x + 14, y + 14, 6, hex("#c8102e")); circle(x + 42, y + 42, 6, hex("#c9a227"));
  circle(x + 14, y + 42, 5, hex("#efe9da")); circle(x + 42, y + 14, 5, hex("#17150f"));
}
function thStorm(x: number, y: number): void {
  fillRectGrad(x, y, 56, 56, hex("#2b2f3a"), hex("#4a4a55"));
  ellipse(x + 28, y + 20, 20, 10, hex("#8a8a95")); ellipse(x + 18, y + 24, 12, 8, hex("#8a8a95")); ellipse(x + 38, y + 24, 12, 8, hex("#8a8a95"));
  poly([[x + 26, y + 26], [x + 20, y + 40], [x + 26, y + 40], [x + 22, y + 52], [x + 32, y + 34], [x + 26, y + 34]], hex("#e8b84b"));
  fillRect(x, y + 48, 56, 8, hex("#1a1a1a"));
}

// ---------- badges ----------
function badge(x: number, y: number, text: string, c: RGB): number {
  const w = textW(SB, text, 10) + 12;
  roundRect(x, y, w, 15, 3, c);
  drawText(SB, text, x + 6, y + 3, 10, hex("#ffffff"));
  return w;
}

// ---------- content ----------
interface Lead { n: number; region: string; badge: string; badgeC: RGB; kicker: string; headline: string; deck: string; source: string; scene: (x: number, y: number, w: number, h: number) => void; }
const LEADS: Lead[] = [
  { n: 1, region: "MIDDLE EAST · KUWAIT", badge: "CLAIM", badgeC: RED, kicker: "DRONE ATTACK",
    headline: "Drones kill two Italians in Kuwait; Rome blames Iran",
    deck: "Two Italian technicians killed. Italy and Kuwait blame Iran; Tehran denies it.",
    source: "Reuters · 26 Nov", scene: sceneKuwait },
  { n: 2, region: "EUROPE · BRUSSELS", badge: "REPORTED", badgeC: NAVY, kicker: "SUMMIT FAILS",
    headline: "EU summit fails: no deal on €1.58tn budget or €45bn loan",
    deck: "No deal on the €1.58 trillion budget or the €45bn Ukraine loan. The second day was cancelled.",
    source: "Reuters · 26 Nov", scene: sceneSummit },
  { n: 3, region: "ASIA · SEOUL", badge: "REPORTED", badgeC: NAVY, kicker: "RATES RISE",
    headline: "Bank of Korea raises rates to 3.25%",
    deck: "The Bank of Korea raised its policy rate by 25 basis points to 3.25%.",
    source: "Reuters · 26 Nov", scene: sceneBank },
];
interface Med { n: number; region: string; claim: boolean; headline: string; detail: string; th: (x: number, y: number) => void; }
const MEDS: Med[] = [
  { n: 4, region: "ASIA · BOGOR", claim: false, headline: "13 dead, 13 trapped in Bogor gold mine", detail: "Search resumed on Thursday", th: thMine },
  { n: 5, region: "ASIA · HONG KONG", claim: false, headline: "A year after the Wang Fuk Court fire", detail: "HK$300k/flat · HK$200k/family", th: thTower },
  { n: 6, region: "ASIA · SINGAPORE", claim: false, headline: "Asia shares bounce back", detail: "Markets steady region-wide", th: thChart },
  { n: 7, region: "MIDDLE EAST · RIYADH", claim: true, headline: "Saudi says it stopped Houthi missiles", detail: "Coalition claim, unconfirmed", th: thShield },
  { n: 8, region: "MIDDLE EAST · KHASAB", claim: true, headline: "IRGC says two tankers hit sea mines", detail: "UKMTO: only a 25 Nov strike", th: thShip },
  { n: 9, region: "EUROPE · LONDON", claim: false, headline: "UK and EU publish Brexit-reset texts", detail: "Texts published on Thursday", th: thTreaty },
  { n: 10, region: "EUROPE · GENEVA", claim: false, headline: "Gukesh and Sindarov draw Game 3", detail: "60 moves · match level 1.5–1.5", th: thChess },
  { n: 11, region: "NORTH AMERICA · NEW YORK", claim: false, headline: "Nor'easter batters US East Coast", detail: "1M+ homes without power by Thu evening", th: thStorm },
];
const ALSO: { n: number; text: string; flag: string }[] = [
  { n: 12, text: "Chinese firms a growing threat to Japanese rivals — JETRO", flag: "" },
  { n: 13, text: "Uber names Rakesh Ranjan India & South Asia chief", flag: "" },
  { n: 14, text: "India marks 18 years since 26/11, and Constitution Day", flag: "" },
  { n: 15, text: "Vietnam races US to finish trade deal soon", flag: "" },
  { n: 16, text: "EU to nominate Hernández de Cos as next ECB chief", flag: "" },
  { n: 17, text: "16th London Chess Classic gets underway", flag: "" },
  { n: 18, text: "King tides flood California coast through Thanksgiving", flag: "" },
  { n: 19, text: "US markets shut for Thanksgiving", flag: "" },
  { n: 20, text: "Mexico seeks talks with US on SpaceX airspace use", flag: "" },
  { n: 21, text: "S. Africa producer inflation jumps to 8.1%", flag: "" },
  { n: 22, text: "Rand heads for worst November in 25 years", flag: "" },
  { n: 23, text: "Virgin Australia ground staff strike for 2–3 hours", flag: "" },
  { n: 24, text: "$250 fines for rockpool rule-breakers take effect", flag: "" },
  { n: 25, text: "Macy's parade postponed to Saturday, a first in 100 years", flag: "†" },
  { n: 26, text: "Kim Jong Un orders tactical-nuclear deployment", flag: "†" },
  { n: 27, text: "Australia's treasurer calls 4.9% inflation “a very serious moment”", flag: "†" },
];
const NUMBERS: [string, string][] = [
  ["€1.58tn", "EU budget at stake"],
  ["€45bn", "Ukraine loan at stake"],
  ["3.25%", "Bank of Korea rate"],
  ["8.1%", "S. Africa producer inflation"],
  ["60", "moves in FIDE Game 3 draw"],
  ["13 / 13", "dead / trapped in Bogor mine"],
];
const CHIPS: [string, string][] = [
  ["ASIA", "8"], ["EUROPE", "5"], ["NORTH AMERICA", "3"], ["LATIN AMERICA", "1"],
  ["MIDDLE EAST", "3"], ["AFRICA", "2"], ["PACIFIC", "2"], ["BORDERLINE †", "3"],
];
function drawFit(f: Face, text: string, x: number, y: number, size: number, maxW: number, c: RGB, align: "l" | "c" | "r" = "l"): number {
  let s = size;
  while (s > 8 && textW(f, text, s) > maxW) s -= 0.5;
  drawText(f, text, x, y, s, c, align);
  return s;
}

// ---------- layout ----------
function drawPage(): void {
  fillRect(0, 0, W, H, PAPER);
  // masthead
  fillRect(28, 10, 968, 2, INK);
  drawText(SB, "THE WORLD IN ONE DAY", 512, 16, 44, INK, "c", 3);
  drawText(SB, "THURSDAY 26 NOVEMBER 2026", 512, 64, 30, RED, "c", 2);
  drawText(SR, "Kuwait drone attack kills two Italians · EU summit fails on €1.58tn budget · Bank of Korea lifts rates to 3.25%", 512, 104, 15, RED, "c");
  fillRect(28, 126, 968, 1, LINE);
  // region chips
  let chipW = 0;
  for (const [name, cnt] of CHIPS) chipW += textW(SB, name + " " + cnt, 13) + 22 + 10;
  chipW -= 10;
  let cx = 512 - chipW / 2;
  for (const [name, cnt] of CHIPS) {
    const w = textW(SB, name + " " + cnt, 13) + 22;
    const c = name === "BORDERLINE †" ? hex("#8a6d1f") : (RC as Record<string, RGB>)[
      name === "ASIA" ? "AS" : name === "EUROPE" ? "EU" : name === "NORTH AMERICA" ? "NA" :
      name === "LATIN AMERICA" ? "LA" : name === "MIDDLE EAST" ? "ME" : name === "AFRICA" ? "AF" : "PA"];
    roundRect(cx, 136, w, 24, 4, c);
    drawText(SB, name + "  " + cnt, cx + 11, 141, 13, hex("#ffffff"));
    cx += w + 10;
  }
  drawText(SR, "27 STORIES · 7 REGIONS · ALL DATES CHECKED — SEE DATE CHECK BELOW", 512, 170, 12, GRAY, "c", 1);
  fillRect(28, 188, 968, 2, INK);
  // map section
  drawText(SB, "WHERE IT HAPPENED", 28, 200, 16, INK);
  drawText(SR, "27 stories, numbered — pins match the story numbers below", 996, 202, 11, GRAY, "r");
  drawMap();
  drawText(SR, "Pins are numbered to match the stories below.  † = borderline (see DATE CHECK).", 512, 410, 11, GRAY, "c");
  // lead cards
  drawText(SB, "TOP STORIES", 28, 416, 14, INK);
  fillRect(28, 430, 968, 1, LINE);
  const cw = 312, gap = 16;
  LEADS.forEach((L, i) => {
    const x = 28 + i * (cw + gap), y = 436;
    L.scene(x, y, cw, 84);
    circle(x + 16, y + 98, 11, RED);
    drawText(SB, String(L.n), x + 16, y + 91, 13, hex("#ffffff"), "c");
    drawText(SB, L.region, x + 32, y + 92, 11, GRAY);
    const bw = badge(x + 32, y + 106, L.badge, L.badgeC);
    drawText(SB, L.kicker, x + 32 + bw + 6, y + 108, 11, RED);
    const hl = wrapText(SB, L.headline, 20, cw);
    hl.slice(0, 2).forEach((ln, j) => drawText(SB, ln, x, y + 122 + j * 23, 20, INK));
    drawPara(SR, L.deck, x, y + 172, 11.5, cw, INK, 14);
    drawText(SR, L.source, x, y + 204, 10, GRAY);
  });
  // numbers panel
  fillRect(28, 658, 968, 64, NAVY);
  drawText(SB, "THE DAY IN NUMBERS", 44, 666, 13, GOLD);
  NUMBERS.forEach(([num, label], i) => {
    const x = 44 + i * 158;
    drawText(SB, num, x, 684, 20, hex("#ffffff"));
    drawFit(SR, label, x, 706, 10, 150, hex("#c9d8e2"));
  });
  // medium cards
  drawText(SB, "MORE FROM THE DAY", 28, 730, 14, INK);
  fillRect(28, 744, 968, 1, LINE);
  MEDS.forEach((M, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 28 + col * (235 + 9), y = 752 + row * (62 + 6);
    M.th(x, y);
    const tx = x + 64;
    drawText(SB, M.region + (M.claim ? " · CLAIM" : ""), tx, y + 1, 9, M.claim ? RED : GRAY);
    const hl = wrapText(SB, M.headline, 12.5, 235 - 64);
    hl.slice(0, 2).forEach((ln, j) => drawText(SB, ln, tx, y + 13 + j * 15, 12.5, INK));
    drawFit(SR, M.detail, tx, y + 45, 11, 235 - 64, GRAY);
  });
  // also-on list
  drawText(SB, "ALSO ON...", 28, 882, 13, INK);
  fillRect(28, 896, 968, 1, LINE);
  const colW = (968 - 2 * 16) / 3;
  ALSO.forEach((A, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 28 + col * (colW + 16), y = 902 + row * 10.5;
    drawText(SB, String(A.n) + ".", x, y, 10.5, RED);
    const fs = drawFit(SR, A.text, x + 20, y, 10.5, colW - 20 - 8, INK);
    if (A.flag) drawText(SB, "†", x + 20 + textW(SR, A.text, fs) + 2, y, fs, RED);
  });
  // footer
  fillRect(28, 968, 968, 1, LINE);
  drawPara(SB, "DATE CHECK: 24 stories first reported on Thursday 26 November 2026.  † 3 borderline stories are flagged above — Macy's and Kim were reported 25 Nov; the Australia CPI item is a reaction to data released 25 Nov.", 28, 972, 11, 968, RED, 12.5);
  drawText(SR, "HOW SURE: REPORTED = confirmed by wire reports · CLAIM = one side's claim, not independently confirmed · Scenes are drawn illustrations, not photographs.", 28, 1000, 10, GRAY);
}

// ---------- main ----------
function main(): void {
  drawPage();
  const png = encodePNG();
  mkdirSync("/output", { recursive: true });
  writeFileSync("/output/entry.png", png);
}
main();
