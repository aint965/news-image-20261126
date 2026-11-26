// THE WORLD TODAY — Thursday 26 November 2026 (v2)
// A program that draws a newspaper front page summing up the day's world
// news and writes it as a 1024x1024 PNG. Node 22, standard library only,
// no network, fully deterministic: the same bytes on every run.
//
// Layout (1024 x 1024, warm paper, ink + navy + red + region colours):
//   masthead + date + red summary line + region chips,
//   THREE big feature stories, each with a drawn scene (tariffs, Cairo
//   fire, Gaza strike), EIGHT more stories, each with a small drawn
//   scene, then a numbered text-only list of 14 more stories (25 in
//   all), a dark numbers strip, a DATE CHECK strip and a fine-print
//   footer. Masthead and feature headlines use a serif display face
//   (bold 5x7 glyphs with slab feet); body text stays in the plain face.
// Every story was first reported on Thursday 26 November 2026 (in some
// time zone); older stories are named in the DATE CHECK strip as left
// out. Status badges: CONFIRMED (2+ outlets), OFFICIAL (on the record),
// REPORTED (one outlet), CLAIM (one side's word).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [17, 17, 17];
const RED: RGB = [185, 28, 28];
const NAVY: RGB = [30, 58, 95];
const FAINT: RGB = [120, 112, 98];
const SKY: RGB = [186, 214, 235];
const SKY2: RGB = [214, 228, 238];
const SEA: RGB = [56, 130, 170];
const SAND: RGB = [232, 213, 175];
const SMOKE: RGB = [150, 148, 142];
const SMOKE2: RGB = [110, 108, 102];
const FLAME1: RGB = [220, 60, 30];
const FLAME2: RGB = [245, 160, 40];
const FLAME3: RGB = [250, 210, 80];
const LEAF: RGB = [46, 110, 62];
const BLUE: RGB = [29, 78, 216];
const TEAL: RGB = [13, 148, 136];
const PURPLE: RGB = [124, 58, 237];
const AMBER: RGB = [217, 119, 6];
const PINK: RGB = [190, 24, 93];
const GREEN: RGB = [21, 128, 61];
const BROWN: RGB = [146, 64, 14];
const WHITE: RGB = [255, 255, 255];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPixel(x: number, y: number, c: RGB): void {
  // Round to whole pixels: callers sometimes pass fractional coordinates
  // (e.g. w / 2 of an odd width), and a fractional index writes nothing.
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, t: number, c: RGB): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, t: number, c: RGB): void {
  fillRect(x, y, t, h, c);
}
function rectOutline(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  hline(x, y, w, t, c);
  hline(x, y + h - t, w, t, c);
  vline(x, y, h, t, c);
  vline(x + w - t, y, h, t, c);
}
function drawLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  // Round endpoints to whole pixels and bound the step count, so a line
  // can never loop forever even if a caller passes fractional coordinates.
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const steps = Math.max(dx, -dy) + 1;
  for (let i = 0; i < steps; i++) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
// Scanline fill of a triangle.
function fillTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
  const minY = Math.max(0, Math.min(ay, by, cy));
  const maxY = Math.min(H - 1, Math.max(ay, by, cy));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [
      [ax, ay, bx, by],
      [bx, by, cx, cy],
      [cx, cy, ax, ay],
    ];
    for (const [x0, y0, x1, y1] of edges) {
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.max(0, Math.ceil(Math.min(xs[0], xs[1])));
      const hi = Math.min(W - 1, Math.floor(Math.max(xs[0], xs[1])));
      for (let x = lo; x <= hi; x++) setPixel(x, y, c);
    }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPixel(x, y, c);
    }
  }
}
function circleOutline(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    fillRect(Math.round(cx + r * Math.cos(rad)) - Math.floor(t / 2), Math.round(cy + r * Math.sin(rad)) - Math.floor(t / 2), t, t, c);
  }
}
// Vertical gradient band: rows of solid colour from top to bottom.
function vgrad(x: number, y: number, w: number, h: number, top: RGB, bot: RGB): void {
  for (let yy = 0; yy < h; yy++) {
    const f = h <= 1 ? 0 : yy / (h - 1);
    const c: RGB = [
      Math.round(top[0] + (bot[0] - top[0]) * f),
      Math.round(top[1] + (bot[1] - top[1]) * f),
      Math.round(top[2] + (bot[2] - top[2]) * f),
    ];
    hline(x, y + yy, w, 1, c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, 5 bits wide (bit 4 = leftmost column).
type Glyph = [number, number, number, number, number, number, number];
const FONT: Record<string, Glyph> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "—": [0, 0, 0, 0x1f, 0x1f, 0, 0],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "•": [0, 0, 0x0e, 0x1f, 0x0e, 0, 0],
};
const BLANK: Glyph = [0, 0, 0, 0, 0, 0, 0];

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}
// Draw one glyph's set pixels, optionally shifted by (ox, oy).
function drawGlyph(x: number, y: number, ch: string, scale: number, c: RGB, ox: number): void {
  const g = FONT[ch] ?? BLANK;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if ((g[row] >> (4 - col)) & 1) {
        fillRect(x + ox + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawGlyph(cx, y, ch, scale, c, 0);
    cx += 6 * scale;
  }
}
// Bold: second pass shifted 1px right, so stems get one pixel thicker.
function drawTextBold(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawGlyph(cx, y, ch, scale, c, 0);
    drawGlyph(cx, y, ch, scale, c, 1);
    cx += 6 * scale;
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function drawTextCenteredBold(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawTextBold(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Serif display face (cheap): the 5x7 glyphs drawn bold, plus a foot on
// the bottom row — each run of the bottom row widened by one cell on each
// side, so stems end in small slab feet and each line of display text
// sits on a thin baseline rule, like a newspaper headline face. Advance
// is 7*scale so neighbouring feet just meet.
function drawGlyphSerif(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = FONT[ch] ?? BLANK;
  for (const ox of [0, 1]) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((g[row] >> (4 - col)) & 1) fillRect(x + ox + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
  const bot = g[6];
  if (bot) {
    let col = 0;
    while (col < 5) {
      if ((bot >> (4 - col)) & 1) {
        let end = col;
        while (end + 1 < 5 && ((bot >> (4 - (end + 1))) & 1)) end++;
        fillRect(x + (col - 1) * scale, y + 6 * scale, (end - col + 3) * scale, scale, c);
        col = end + 1;
      } else col++;
    }
  }
}
function textWidthSerif(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 7 * scale - scale;
}
function drawTextSerif(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawGlyphSerif(cx, y, ch, scale, c);
    cx += 7 * scale;
  }
}
function drawTextSerifCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawTextSerif(cx - Math.floor(textWidthSerif(s, scale) / 2), y, s, scale, c);
}
function wrapSerif(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidthSerif(trial, scale) <= maxWidth) cur = trial;
    else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
function drawWrappedSerif(x: number, y: number, s: string, maxWidth: number, scale: number, c: RGB, gap: number): number {
  const lines = wrapSerif(s, maxWidth, scale);
  let yy = y;
  for (const ln of lines) {
    drawTextSerif(x, yy, ln, scale, c);
    yy += 7 * scale + gap;
  }
  return yy;
}
// Greedy word wrap; returns lines that fit maxWidth. Never splits a word.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
// Draw wrapped lines starting at (x, y), line pitch = 7*scale + gap.
function drawWrapped(x: number, y: number, s: string, maxWidth: number, scale: number, c: RGB, bold: boolean, gap: number): number {
  const lines = wrap(s, maxWidth, scale);
  let yy = y;
  for (const ln of lines) {
    if (bold) drawTextBold(x, yy, ln, scale, c);
    else drawText(x, yy, ln, scale, c);
    yy += 7 * scale + gap;
  }
  return yy;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- scene kit
// Small reusable drawing pieces for the story scenes. All coordinates are
// absolute; each scene function draws inside its own box (x, y, w, h).
function person(x: number, y: number, s: number, c: RGB): void {
  // (x, y) = feet centre. Height about 22*s.
  fillCircle(x, y - 19 * s, 4 * s, c); // head
  fillRect(x - 3 * s, y - 15 * s, 6 * s, 9 * s, c); // torso
  fillRect(x - 3 * s, y - 6 * s, 2 * s, 6 * s, c); // leg L
  fillRect(x + s, y - 6 * s, 2 * s, 6 * s, c); // leg R
}
function helmetPerson(x: number, y: number, s: number, c: RGB, helm: RGB): void {
  person(x, y, s, c);
  fillCircle(x, y - 19 * s, 4 * s, helm); // helmet over head
  fillRect(x - 4 * s, y - 19 * s, 8 * s, 2 * s, helm);
}
function flame(x: number, y: number, w: number, h: number): void {
  // (x, y) = base centre bottom. Layered tongues of fire.
  fillTriangle(x - w / 2, y, x, y - h, x + w / 2, y, FLAME1);
  fillTriangle(x - w / 3, y, x - w / 8, y - h * 0.62, x + w / 3, y, FLAME2);
  fillTriangle(x - w / 6, y, x + w / 10, y - h * 0.38, x + w / 5, y, FLAME3);
}
function smokePuff(cx: number, cy: number, r: number): void {
  fillCircle(cx, cy, r, SMOKE);
  fillCircle(cx - r * 0.7, cy + r * 0.3, r * 0.7, SMOKE2);
  fillCircle(cx + r * 0.7, cy + r * 0.4, r * 0.6, SMOKE);
}
function buildingBlock(x: number, y: number, w: number, h: number, c: RGB): void {
  fillRect(x, y, w, h, c);
  // window grid in paper colour
  const cols = Math.max(1, Math.floor(w / 14));
  const rows = Math.max(1, Math.floor(h / 16));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      fillRect(x + 4 + i * 14, y + 5 + j * 16, 7, 8, PAPER);
    }
  }
}
function planeSide(x: number, y: number, len: number, c: RGB): void {
  // Side-view airliner, nose to the right, (x, y) = tail top.
  const h = 10;
  fillRect(x, y, len, h, c); // fuselage
  fillTriangle(x + len, y, x + len, y + h, x + len + 14, y + h / 2, c); // nose
  fillTriangle(x + 4, y, x + 4, y - 16, x + 18, y, c); // tail fin
  fillTriangle(x + len * 0.45, y + h, x + len * 0.62, y + 22, x + len * 0.72, y + h, c); // wing
  fillRect(x + len * 0.6, y + h + 12, 10, 5, c); // engine
  fillRect(x, y, 10, h, RED); // tail band
  for (let wx = x + 16; wx < x + len - 8; wx += 12) fillRect(wx, y + 2, 5, 3, PAPER); // windows
  drawLine(x - 6, y + h + 26, x + len + 18, y + h + 26, 2, FAINT); // ground line
}
function jetSide(x: number, y: number, len: number, c: RGB): void {
  // Military jet, nose right, (x, y) = fuselage top.
  fillTriangle(x + len, y + 3, x + len + 12, y + 6, x + len, y + 9, c); // nose
  fillRect(x, y + 3, len, 6, c); // fuselage
  fillTriangle(x + 6, y + 3, x + 6, y - 10, x + 18, y + 3, c); // tail fin
  fillTriangle(x + len * 0.4, y + 9, x + len * 0.55, y + 18, x + len * 0.7, y + 9, c); // wing
  fillRect(x + 2, y + 3, 8, 6, RED); // tail stripe
}
function droneQuad(x: number, y: number, s: number, c: RGB): void {
  fillRect(x - 5 * s, y - 2 * s, 10 * s, 4 * s, c);
  drawLine(x - 9 * s, y - 5 * s, x + 9 * s, y + 5 * s, 2, c);
  drawLine(x + 9 * s, y - 5 * s, x - 9 * s, y + 5 * s, 2, c);
  fillCircle(x - 10 * s, y - 6 * s, 3 * s, c);
  fillCircle(x + 10 * s, y - 6 * s, 3 * s, c);
  fillCircle(x - 10 * s, y + 6 * s, 3 * s, c);
  fillCircle(x + 10 * s, y + 6 * s, 3 * s, c);
}
function portCrane(x: number, y: number, h: number, c: RGB): void {
  // (x, y) = base of the legs.
  vline(x, y - h, h, 4, c);
  vline(x + 18, y - h, h, 4, c);
  hline(x - 8, y - h, 60, 4, c); // jib
  hline(x - 8, y - h + 12, 26, 3, c); // counter-jib
  vline(x + 44, y - h, 26, 2, c); // hook cable
  fillRect(x + 40, y - h + 26, 8, 6, c); // hook block
}
function flagOnPole(x: number, y: number, h: number, c: RGB): void {
  vline(x, y - h, h, 3, INK);
  fillRect(x + 2, y - h, 34, 20, c);
  fillCircle(x + 19, y - h + 10, 4, PAPER); // star dot
}

// ---------------------------------------------------------------- the scenes
// 1 — US tariffs: container ship at a port, cranes, red hull stripe.
function sceneTariffs(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h - 30, SKY2, SKY);
  fillRect(x, y + h - 30, w, 30, SEA);
  // port cranes behind the ship
  portCrane(x + 18, y + h - 34, 52, INK);
  portCrane(x + w - 78, y + h - 34, 46, INK);
  // containers: three stacks
  const cw = 34;
  const ch = 16;
  const baseX = x + 34;
  const seaY = y + h - 34;
  const heights = [3, 2, 3, 2];
  const cols = [NAVY, RED, INK, TEAL];
  for (let i = 0; i < 4; i++) {
    for (let r = 0; r < heights[i]; r++) {
      const cx = baseX + i * (cw + 5);
      const cy = seaY - ch - r * (ch + 3);
      fillRect(cx, cy, cw, ch, cols[i]);
      rectOutline(cx, cy, cw, ch, 1, PAPER);
    }
  }
  // bridge tower
  fillRect(baseX + 4 * (cw + 5) + 2, seaY - 2 * (ch + 3) - 6, 20, 2 * (ch + 3) + 6, INK);
  fillRect(baseX + 4 * (cw + 5) + 2, seaY - 2 * (ch + 3) - 6, 20, 8, RED);
  // hull
  fillTriangle(x + 20, seaY, x + w - 20, seaY, x + w - 40, seaY + 22, INK);
  fillRect(x + 20, seaY, w - 40, 5, RED);
  // waves
  for (let wx = x + 10; wx < x + w - 10; wx += 24) {
    drawLine(wx, y + h - 8, wx + 12, y + h - 8, 2, PAPER);
  }
  // gulls
  drawLine(x + w - 60, y + 12, x + w - 52, y + 16, 2, INK);
  drawLine(x + w - 52, y + 16, x + w - 44, y + 12, 2, INK);
}
// 2 — Cairo tanker fire: tanker truck, flames, smoke, skyline, fire crew.
function sceneCairo(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, [238, 200, 150], [240, 220, 180]);
  // skyline silhouette
  buildingBlock(x + 8, y + 18, 34, 44, FAINT);
  buildingBlock(x + 48, y + 8, 26, 54, FAINT);
  buildingBlock(x + w - 46, y + 14, 34, 48, FAINT);
  // road
  fillRect(x, y + h - 26, w, 26, INK);
  for (let wx = x + 8; wx < x + w - 8; wx += 26) fillRect(wx, y + h - 14, 14, 3, PAPER);
  // tanker truck: cylinder tank + cab
  const ty = y + h - 52;
  fillRect(x + 18, ty, 120, 26, INK); // tank body
  fillCircle(x + 78, ty + 13, 13, INK);
  fillRect(x + 142, ty + 4, 34, 22, RED); // cab
  fillRect(x + 150, ty + 8, 12, 8, SKY); // cab window
  fillCircle(x + 40, ty + 26, 7, INK);
  fillCircle(x + 120, ty + 26, 7, INK);
  fillCircle(x + 158, ty + 26, 7, INK);
  // flames over the tank
  flame(x + 78, ty - 2, 66, 34);
  flame(x + 130, ty - 2, 40, 22);
  // smoke
  smokePuff(x + 70, y + 12, 12);
  smokePuff(x + 92, y + 22, 9);
  // fire crew with hose
  helmetPerson(x + w - 34, y + h - 28, 1, RED, RED);
  drawLine(x + w - 34, y + h - 44, x + w - 58, y + h - 56, 3, RED);
}
// 3 — Gaza strike: damaged tower, smoke, rubble.
function sceneGaza(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, [206, 204, 196]);
  // damaged tower (jagged top)
  fillRect(x + 20, y + 26, 56, h - 26, INK);
  fillTriangle(x + 20, y + 26, x + 48, y + 8, x + 76, y + 26, INK);
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) fillRect(x + 28 + i * 16, y + 36 + j * 18, 8, 9, PAPER);
  }
  // leaning second block
  drawLine(x + 92, y + 40, x + 128, y + 34, 4, INK);
  fillRect(x + 92, y + 40, 40, h - 40, SMOKE2);
  // smoke plume
  smokePuff(x + 48, y + 10, 13);
  smokePuff(x + 66, y + 20, 9);
  smokePuff(x + 110, y + 26, 8);
  // rubble at the base
  fillTriangle(x + 16, y + h, x + 40, y + h - 16, x + 64, y + h, SMOKE2);
  fillTriangle(x + 60, y + h, x + 88, y + h - 12, x + 116, y + h, INK);
  fillTriangle(x + 112, y + h, x + 140, y + h - 18, x + 168, y + h, SMOKE2);
  // ground line
  hline(x, y + h - 2, w, 2, INK);
}
// 4 — Sudan: dam on the Blue Nile, drone overhead.
function sceneSudan(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h - 12, SKY2, SKY);
  // river
  fillRect(x, y + h - 12, w, 12, SEA);
  for (let wx = x + 8; wx < x + w - 8; wx += 22) drawLine(wx, y + h - 6, wx + 10, y + h - 6, 2, PAPER);
  // dam wall
  fillRect(x + 10, y + 12, w - 20, 28, SMOKE2);
  for (let vx = x + 26; vx < x + w - 16; vx += 20) vline(vx, y + 16, 20, 2, INK);
  // spillway water
  fillRect(x + Math.floor(w / 2) - 12, y + 18, 24, 22, [220, 235, 245]);
  // drone in the sky
  droneQuad(x + w - 30, y + 7, 1, INK);
  // small boat on the river
  fillTriangle(x + w - 70, y + h - 10, x + w - 40, y + h - 10, x + w - 55, y + h - 4, RED);
}
// 5 — Lebanon: second airport, airliner on the runway.
function sceneLebanon(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, SKY);
  // hills
  fillTriangle(x, y + h - 28, x + 50, y + h - 46, x + 100, y + h - 28, SAND);
  fillTriangle(x + w - 110, y + h - 28, x + w - 55, y + h - 42, x + w, y + h - 28, SAND);
  // terminal + control tower
  fillRect(x + 12, y + h - 42, 96, 16, INK);
  for (let wx = x + 18; wx < x + 100; wx += 12) fillRect(wx, y + h - 38, 6, 7, PAPER);
  fillRect(x + 116, y + h - 50, 8, 24, INK);
  fillRect(x + 112, y + 2, 16, 6, RED);
  // runway
  fillRect(x, y + h - 26, w, 10, INK);
  for (let wx = x + 10; wx < x + w - 10; wx += 28) fillRect(wx, y + h - 22, 14, 2, PAPER);
  // airliner in red, so it stands out from the black terminal (proper side view, not an arrow)
  planeSide(x + Math.floor(w / 2) - 52, y + 24, 96, RED);
}
// 6 — North Korea: missile, facility, flag.
function sceneNK(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, [226, 220, 210]);
  // facility building
  fillRect(x + 12, y + h - 22, 84, 16, INK);
  for (let wx = x + 18; wx < x + 88; wx += 14) fillRect(wx, y + h - 18, 7, 7, PAPER);
  fillRect(x + 100, y + h - 30, 24, 24, SMOKE2);
  // missile, vertical, with flame and smoke
  const mx = x + w - 66;
  fillRect(mx, y + 12, 12, 28, INK); // body
  fillTriangle(mx, y + 12, mx + 12, y + 12, mx + 6, y + 2, RED); // nose
  fillTriangle(mx - 6, y + 40, mx, y + 32, mx, y + 40, INK); // fin L
  fillTriangle(mx + 12, y + 40, mx + 18, y + 40, mx + 12, y + 32, INK); // fin R
  flame(mx + 6, y + 42, 14, 8);
  smokePuff(mx - 10, y + h - 8, 6);
  smokePuff(mx + 22, y + h - 6, 5);
  // flag
  flagOnPole(x + w - 38, y + h - 6, 30, RED);
  // ground
  hline(x, y + h - 6, w, 2, INK);
}
// 7 — Indonesia: gold-mine flood in the Bogor hills.
function sceneIndonesia(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, SKY);
  // mountain
  const hw = Math.floor(w / 2);
  fillTriangle(x, y + h, x + hw, y + 6, x + w, y + h, LEAF);
  fillTriangle(x + hw - 16, y + 6, x + hw, y + 6, x + hw + 16, y + 26, PAPER);
  // mine entrance (dark arch)
  fillRect(x + hw - 22, y + h - 34, 44, 34, INK);
  fillTriangle(x + hw - 22, y + h - 34, x + hw + 22, y + h - 34, x + hw, y + h - 48, INK);
  // flood water pouring out
  fillRect(x + hw - 30, y + h - 12, 60, 12, SEA);
  for (let wx = x + hw - 28; wx < x + hw + 28; wx += 14) drawLine(wx, y + h - 6, wx + 7, y + h - 6, 2, PAPER);
  // rescue crew with a rope
  helmetPerson(x + 26, y + h - 4, 1, RED, RED);
  helmetPerson(x + 46, y + h - 4, 1, NAVY, RED);
  drawLine(x + 30, y + h - 20, x + hw - 20, y + h - 26, 2, RED);
}
// 8 — Bangladesh: garment factory, workers, rising wage bars.
function sceneBangladesh(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, SKY);
  // factory with sawtooth roof
  fillRect(x + 10, y + 34, 92, h - 34, INK);
  fillTriangle(x + 10, y + 34, x + 33, y + 18, x + 56, y + 34, INK);
  fillTriangle(x + 56, y + 34, x + 79, y + 18, x + 102, y + 34, INK);
  for (let wx = x + 16; wx < x + 96; wx += 14) fillRect(wx, y + 42, 7, 8, PAPER);
  // chimney + smoke
  fillRect(x + w - 30, y + 16, 12, h - 16, SMOKE2);
  smokePuff(x + w - 24, y + 8, 7);
  // workers
  person(x + 16, y + h - 2, 1, RED);
  person(x + 34, y + h - 2, 1, NAVY);
  person(x + 52, y + h - 2, 1, INK);
  // wage bars rising
  const bx = x + w - 78;
  const by = y + h - 6;
  fillRect(bx, by - 10, 12, 10, TEAL);
  fillRect(bx + 16, by - 18, 12, 18, TEAL);
  fillRect(bx + 32, by - 28, 12, 28, RED);
  drawLine(bx - 4, by - 12, bx + 46, by - 34, 3, RED);
  fillTriangle(bx + 46, by - 34, bx + 36, by - 34, bx + 46, by - 26, RED);
}
// 9 — Malaysia: courthouse, scales, Google "G".
function sceneMalaysia(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, SKY);
  // courthouse: pediment + columns + steps
  fillTriangle(x + 14, y + 16, x + Math.floor(w / 2), y + 4, x + w - 14, y + 16, INK);
  for (let i = 0; i < 4; i++) {
    const cx = x + 22 + i * ((w - 44) / 3);
    fillRect(cx, y + 18, 7, 22, INK);
  }
  fillRect(x + 10, y + h - 12, w - 20, 4, INK);
  fillRect(x + 6, y + h - 7, w - 12, 4, INK);
  // scales of justice on the pediment
  const sx = x + Math.floor(w / 2);
  vline(sx, y + 20, 16, 2, RED);
  hline(sx - 12, y + 23, 24, 2, RED);
  fillTriangle(sx - 12, y + 23, sx - 5, y + 23, sx - 8, y + 31, RED);
  fillTriangle(sx + 5, y + 23, sx + 12, y + 23, sx + 8, y + 31, RED);
  // white plaque with a blue G, top-right above the columns
  fillRect(x + w - 46, y + 2, 32, 14, WHITE);
  rectOutline(x + w - 46, y + 2, 32, 14, 2, INK);
  drawTextCentered(x + w - 30, y + 3, "G", 2, BLUE);
}
// 10 — Britain: RAF jet in a hangar, drone net overhead.
function sceneUK(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, NAVY, [96, 118, 148]);
  // hangar
  fillRect(x + 12, y + 30, w - 24, h - 30, INK);
  fillTriangle(x + 12, y + 30, x + Math.floor(w / 2), y + 10, x + w - 12, y + 30, INK);
  // jet on the apron
  jetSide(x + 30, y + h - 34, 74, PAPER);
  // drone net: a few diagonal crosshatch lines over the hangar front
  for (let i = 0; i < 3; i++) {
    drawLine(x + 16 + i * 34, y + 34, x + 40 + i * 34, y + h - 6, 1, [200, 200, 200]);
    drawLine(x + 40 + i * 34, y + 34, x + 16 + i * 34, y + h - 6, 1, [200, 200, 200]);
  }
  // drone silhouette in the night sky
  droneQuad(x + w - 36, y + 14, 1, PAPER);
  // moon
  fillCircle(x + 24, y + 12, 8, PAPER);
}
// 11 — Ukraine: air base strike, jets, blast.
function sceneUkraine(x: number, y: number, w: number, h: number): void {
  vgrad(x, y, w, h, SKY2, SKY);
  // control tower
  fillRect(x + 12, y + 18, 10, h - 18, INK);
  fillRect(x + 8, y + 10, 18, 10, RED);
  // runway
  fillRect(x, y + h - 26, w, 12, INK);
  for (let wx = x + 10; wx < x + w - 10; wx += 28) fillRect(wx, y + h - 21, 14, 2, PAPER);
  // intact jet taxiing
  jetSide(x + 34, y + h - 42, 62, INK);
  // blast on the far jet
  const bx = x + w - 56;
  const by = y + h - 32;
  fillCircle(bx, by, 10, FLAME2);
  fillCircle(bx, by, 6, FLAME3);
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    drawLine(Math.round(bx + 10 * Math.cos(rad)), Math.round(by + 10 * Math.sin(rad)), Math.round(bx + 16 * Math.cos(rad)), Math.round(by + 16 * Math.sin(rad)), 3, FLAME1);
  }
  // damaged jet silhouette under the blast
  jetSide(bx - 46, by + 8, 52, SMOKE2);
  smokePuff(bx, y + 16, 10);
}

// ---------------------------------------------------------------- page
const MX = 32; // content left edge
const CW = 960; // content width
const RX = MX + CW; // content right edge (992)

// Region chips: label + colour. Counts sum to the 25 stories on the page.
const REGIONS: [string, RGB][] = [
  ["AFRICA 7", AMBER],
  ["EUROPE 6", PURPLE],
  ["MIDEAST 4", RED],
  ["N.AMER 3", BLUE],
  ["S.AMER 1", TEAL],
  ["E.ASIA 1", PINK],
  ["SE.ASIA 2", GREEN],
  ["S.ASIA 1", BROWN],
];

function drawRegionChips(y: number): void {
  // Measure the whole row, then centre it.
  let total = 0;
  for (const [label] of REGIONS) total += 12 + 4 + textWidth(label, 2);
  total += (REGIONS.length - 1) * 8;
  let cx = 512 - Math.floor(total / 2);
  for (const [label, col] of REGIONS) {
    fillRect(cx, y + 1, 12, 12, col);
    drawText(cx + 16, y, label, 2, INK);
    cx += 12 + 4 + textWidth(label, 2) + 8;
  }
}

// Status colours for the badges on the three feature stories.
function statusColor(s: string): RGB {
  if (s === "CONFIRMED") return GREEN;
  if (s === "OFFICIAL") return NAVY;
  if (s === "REPORTED") return AMBER;
  return RED; // CLAIM
}

type Feature = { n: string; kicker: string; head: string; deck: string; src: string; status: string; scene: (x: number, y: number, w: number, h: number) => void };
const FEATURES: Feature[] = [
  {
    n: "1",
    kicker: "TRADE • WASHINGTON",
    head: "US HITS 14 PARTNERS WITH NEW TARIFFS",
    deck: "CHINA +20%, EU 15% — MARKETS FALL",
    src: "SOURCES: REUTERS, USTR",
    status: "CONFIRMED",
    scene: sceneTariffs,
  },
  {
    n: "2",
    kicker: "DISASTER • CAIRO",
    head: "FUEL TANKER FIRE KILLS AT LEAST 30",
    deck: "RING ROAD BLAZE TORCHES 27 VEHICLES",
    src: "SOURCES: AP, REUTERS",
    status: "CONFIRMED",
    scene: sceneCairo,
  },
  {
    n: "3",
    kicker: "MIDDLE EAST • GAZA",
    head: "ISRAELI STRIKE KILLS HAMAS SECURITY CHIEF",
    deck: "FAMILY OF FOUR KILLED IN SHATI CAMP",
    src: "SOURCES: REUTERS, XINHUA",
    status: "CONFIRMED",
    scene: sceneGaza,
  },
];

function drawFeature(f: Feature, x: number): void {
  const w = 309;
  // Scene box with a status tag at its top-right corner.
  rectOutline(x, 174, w, 96, 2, INK);
  f.scene(x + 2, 176, w - 4, 92);
  const tagW = textWidth(f.status, 2) + 10;
  fillRect(x + w - tagW - 4, 178, tagW, 18, WHITE);
  rectOutline(x + w - tagW - 4, 178, tagW, 18, 1, INK);
  drawTextCentered(x + w - 4 - Math.floor(tagW / 2), 181, f.status, 2, statusColor(f.status));
  // Number badge + kicker.
  fillCircle(x + 9, 285, 9, RED);
  drawTextCentered(x + 9, 278, f.n, 2, WHITE);
  drawTextBold(x + 26, 278, f.kicker, 2, RED);
  // Headline (serif, up to 3 lines) + deck + sources.
  drawWrappedSerif(x, 298, f.head, w, 3, INK, 4);
  drawWrapped(x, 376, f.deck, w, 2, INK, false, 2);
  drawText(x, 412, f.src, 2, FAINT);
}

function drawMasthead(): void {
  drawTextSerifCentered(512, 34, "THE WORLD TODAY", 8, INK);
  hline(MX, 94, CW, 2, INK);
  drawTextSerifCentered(512, 100, "THURSDAY, 26 NOVEMBER 2026 • 25 STORIES • 8 REGIONS", 2, INK);
  drawTextCentered(512, 118, "TARIFFS HIT 14 PARTNERS • 30 DEAD IN CAIRO • HAMAS CHIEF KILLED IN GAZA", 2, RED);
  hline(MX, 138, CW, 3, INK);
  drawRegionChips(146);
  drawFeature(FEATURES[0], MX);
  drawFeature(FEATURES[1], MX + 325);
  drawFeature(FEATURES[2], MX + 650);
}

type GridCell = { n: string; kicker: string; head: string; deck: string; scene: (x: number, y: number, w: number, h: number) => void };
const GRID: GridCell[] = [
  { n: "4", kicker: "SUDAN • BLUE NILE", head: "DRONES KILL 19 CIVILIANS", deck: "DAM, POWER HIT", scene: sceneSudan },
  { n: "5", kicker: "LEBANON • KLEIAT", head: "SECOND AIRPORT TO OPEN", deck: "FLIGHTS 14 DEC", scene: sceneLebanon },
  { n: "6", kicker: "N. KOREA", head: "KIM ORDERS WIDER NUCLEAR PUSH", deck: "ENVOY EXPELLED", scene: sceneNK },
  { n: "7", kicker: "INDONESIA", head: "MINE FLOOD KILLS NINE", deck: "17 STILL TRAPPED", scene: sceneIndonesia },
  { n: "8", kicker: "BANGLADESH", head: "GARMENT PAY UP 36%", deck: "STRIKES GO ON", scene: sceneBangladesh },
  { n: "9", kicker: "MALAYSIA", head: "MALAYSIA SUES GOOGLE", deck: "SEEKING $146M", scene: sceneMalaysia },
  { n: "10", kicker: "BRITAIN • RAF", head: "RAF HIDES JETS FROM DRONES", deck: "HANGARS AT NIGHT", scene: sceneUK },
  { n: "11", kicker: "UKRAINE • RUSSIA", head: "UKRAINE HITS AIR BASE", deck: "5 PLANES DAMAGED", scene: sceneUkraine },
];

function drawGridCell(c: GridCell, x: number, y: number): void {
  const w = 231;
  rectOutline(x, y, w, 56, 2, INK);
  c.scene(x + 2, y + 2, w - 4, 52);
  fillCircle(x + 8, y + 69, 8, RED);
  drawTextCentered(x + 8, y + 62, c.n, 2, WHITE);
  drawTextBold(x + 20, y + 62, c.kicker, 2, RED);
  drawWrapped(x, y + 82, c.head, w, 2, INK, true, 3);
  drawText(x, y + 120, c.deck, 2, INK);
}

function drawNumbersStrip(y: number): void {
  // Dark navy band with the day's big numbers (winner anatomy).
  fillRect(MX, y, CW, 24, NAVY);
  const label = "THE DAY IN NUMBERS:";
  const items = "14 TARIFFS • 30 DEAD • 19 KILLED • 9 MINERS • 36% PAY";
  const total = textWidth(label, 2) + 8 + textWidth(items, 2);
  let cx = 512 - Math.floor(total / 2);
  drawTextBold(cx, y + 5, label, 2, FLAME3);
  cx += textWidth(label, 2) + 8;
  drawText(cx, y + 5, items, 2, WHITE);
}

function drawGrid(): void {
  drawTextBold(MX, 438, "MORE FROM THE DAY — EIGHT STORIES IN PICTURES", 2, INK);
  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    drawGridCell(GRID[i], MX + col * 243, 458 + row * 138);
  }
  drawNumbersStrip(732);
}

// Text-only briefs, numbered 12-31. Each line fits its column at scale 2.
const BRIEFS: string[] = [
  "KYIV MALL HIT BY RUSSIAN MISSILES",
  "MURMANSK GOVERNOR CHIBIS HELD",
  "ECUADOR MINISTER IN US TALKS",
  "34 COUNTRIES PRESS RUSSIA ON AGENT",
  "KENYA CULT LEADER GETS 200 YEARS",
  "2ND JUDGE BLOCKS BIRTHRIGHT ORDER",
  "DURAN DURAN GUITARIST DIES AT 65",
  "BOOKER PRESSES NVIDIA OVER HUANG",
  "IS ATTACK KILLS 2 IN HASAKA",
  "TINUBU VOWS PEACE IN MAIDUGURI",
  "JUDGES: DROP ONE NETANYAHU CASE",
  "UN PULLS EBOLA STAFF FROM CONGO",
  "MILITANTS KILL 30+ IN NIGER STATE",
  "IRAN READY TO WITHSTAND BLOCKADE",
];

function drawBriefs(): void {
  drawTextBold(MX, 766, "ALSO ON 26 NOVEMBER", 2, RED);
  drawText(RX - textWidth("STORIES 12-25", 2), 766, "STORIES 12-25", 2, FAINT);
  for (let i = 0; i < BRIEFS.length; i++) {
    const col = i < 7 ? 0 : 1;
    const row = i % 7;
    const x = col === 0 ? MX : 512;
    const y = 786 + row * 19;
    drawTextBold(x, y, `${12 + i}.`, 2, RED);
    drawText(x + 40, y, BRIEFS[i], 2, INK);
  }
}

function drawDateCheck(): void {
  rectOutline(MX, 922, CW, 56, 2, RED);
  drawTextCentered(512, 928, "DATE CHECK — EVERY STORY HERE HAPPENED OR WAS FIRST REPORTED ON THU 26 NOV 2026.", 2, INK);
  drawTextCentered(512, 945, "IN ANY TIME ZONE. THE DAY'S BIG STORIES BROKE LATE WEDNESDAY IN THE WEST.", 2, INK);
  drawTextCentered(512, 962, "LEFT OUT: CIA BREACH (24 NOV) • RUSSIA LEAK (24 NOV) • NORWAY OIL (13 NOV)", 2, RED);
}

// ---------------------------------------------------------------- page
function drawPage(): void {
  fillAll(PAPER);
  rectOutline(14, 14, W - 28, H - 28, 4, INK);
  rectOutline(22, 22, W - 44, H - 44, 2, INK);
  drawMasthead();
  hline(MX, 430, CW, 2, INK);
  drawGrid();
  hline(MX, 760, CW, 2, INK);
  drawBriefs();
  drawDateCheck();
  drawTextCentered(512, 984, "SOURCES: REUTERS • AP • AFP • KCNA • XINHUA • BBC — HOW SURE: REPORTED, DAY'S WIRES OR OFFICIALS • CLAIM, ONE SIDE'S ACCOUNT • ONGOING, STILL UNFOLDING", 1, FAINT);
}

// ---------------------------------------------------------------- main
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  drawPage();
  const png = encodePng();
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
