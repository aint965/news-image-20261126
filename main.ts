// THE WORLD TODAY — Thursday 26 November 2026
// A program that draws a newspaper front page summing up the day's world
// news and writes it as a 1024x1024 PNG. Node 22, standard library only,
// no network, fully deterministic: the same bytes on every run.
//
// Layout (1024 x 1024, off-white paper, black ink, one red accent):
//   masthead + date line, lead story (US tariffs) with a container-ship
//   pictogram, a 2 x 3 grid of six more stories, each with a small
//   pictogram, and a footer strip with the remaining items.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER: [number, number, number] = [247, 242, 231];
const INK: [number, number, number] = [17, 17, 17];
const RED: [number, number, number] = [185, 28, 28];
const FAINT: [number, number, number] = [120, 112, 98];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
function fillAll(c: [number, number, number]): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPixel(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, t: number, c: [number, number, number]): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, t: number, c: [number, number, number]): void {
  fillRect(x, y, t, h, c);
}
function rectOutline(x: number, y: number, w: number, h: number, t: number, c: [number, number, number]): void {
  hline(x, y, w, t, c);
  hline(x, y + h - t, w, t, c);
  vline(x, y, h, t, c);
  vline(x + w - t, y, h, t, c);
}
function drawLine(x0: number, y0: number, x1: number, y1: number, t: number, c: [number, number, number]): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
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
function fillTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: [number, number, number]): void {
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
function fillCircle(cx: number, cy: number, r: number, c: [number, number, number]): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPixel(x, y, c);
    }
  }
}
function circleOutline(cx: number, cy: number, r: number, t: number, c: [number, number, number]): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    fillRect(Math.round(cx + r * Math.cos(rad)) - Math.floor(t / 2), Math.round(cy + r * Math.sin(rad)) - Math.floor(t / 2), t, t, c);
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
function drawText(x: number, y: number, s: string, scale: number, c: [number, number, number]): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? BLANK;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if ((g[row] >> (4 - col)) & 1) {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: [number, number, number]): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
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

// ---------------------------------------------------------------- pictograms
// Container ship, drawn inside the box (x, y, w, h).
function drawShip(x: number, y: number, w: number, h: number): void {
  const seaY = y + h - 46;
  // Containers: three stacks, one stack red.
  const cw = 48;
  const ch = 30;
  const baseX = x + 16;
  const baseY = seaY - ch;
  const cols = [0, 1, 2, 3];
  const heights = [3, 2, 3, 2];
  for (let i = 0; i < cols.length; i++) {
    for (let r = 0; r < heights[i]; r++) {
      const cx = baseX + cols[i] * (cw + 6);
      const cy = baseY - r * (ch + 4);
      const red = i === 1 && r === 1;
      fillRect(cx, cy, cw, ch, red ? RED : INK);
      // container ribs
      for (let rib = 1; rib < 5; rib++) vline(cx + rib * 9, cy + 3, ch - 6, 2, red ? RED : PAPER);
      rectOutline(cx, cy, cw, ch, 2, PAPER);
    }
  }
  // Bridge tower (right side).
  const towerX = baseX + 4 * (cw + 6) + 4;
  fillRect(towerX, baseY - 3 * (ch + 4) - 8, 30, 3 * (ch + 4) + 8, INK);
  fillRect(towerX, baseY - 3 * (ch + 4) - 8, 30, 10, RED);
  // Hull: trapezoid.
  fillTriangle(x + 12, seaY, x + w - 12, seaY, x + w - 34, seaY + 30, INK);
  fillRect(x + 12, seaY, w - 24, 8, INK);
  fillRect(x + 12, seaY, w - 24, 4, RED);
  // Waves (two rows, kept clear of the caption below).
  for (let i = 0; i < 2; i++) {
    const wy = seaY + 38 + i * 9;
    for (let wx = x + 16; wx < x + w - 16; wx += 26) {
      drawLine(wx, wy, wx + 12, wy, 3, INK);
    }
  }
}

// Small icons for the six story cells; drawn in a 64x64 box at (x, y).
function drawIcon(kind: string, x: number, y: number): void {
  if (kind === "flame") {
    fillTriangle(x + 32, y + 2, x + 6, y + 50, x + 58, y + 50, INK);
    fillTriangle(x + 32, y + 22, x + 18, y + 50, x + 46, y + 50, RED);
    fillRect(x + 4, y + 54, 56, 5, INK);
  } else if (kind === "drone") {
    drawLine(x + 10, y + 14, x + 54, y + 50, 4, INK);
    drawLine(x + 54, y + 14, x + 10, y + 50, 4, INK);
    fillCircle(x + 32, y + 32, 9, INK);
    fillCircle(x + 10, y + 14, 8, RED);
    fillCircle(x + 54, y + 14, 8, RED);
    fillCircle(x + 10, y + 50, 8, RED);
    fillCircle(x + 54, y + 50, 8, RED);
  } else if (kind === "burst") {
    fillCircle(x + 32, y + 32, 12, RED);
    for (let a = 0; a < 360; a += 30) {
      const rad = (a * Math.PI) / 180;
      drawLine(
        Math.round(x + 32 + 16 * Math.cos(rad)),
        Math.round(y + 32 + 16 * Math.sin(rad)),
        Math.round(x + 32 + 30 * Math.cos(rad)),
        Math.round(y + 32 + 30 * Math.sin(rad)),
        4,
        INK,
      );
    }
  } else if (kind === "plane") {
    fillRect(x + 6, y + 28, 52, 8, INK); // fuselage
    fillTriangle(x + 58, y + 28, x + 58, y + 36, x + 70 - 8, y + 32, INK); // nose
    fillTriangle(x + 22, y + 28, x + 34, y + 6, x + 40, y + 28, INK); // wing up
    fillTriangle(x + 22, y + 36, x + 34, y + 56, x + 40, y + 36, INK); // wing down
    fillRect(x + 6, y + 28, 8, 8, RED); // tail
    drawLine(x + 4, y + 58, x + 60, y + 58, 3, INK);
  } else if (kind === "flag") {
    vline(x + 10, y + 4, 54, 4, INK);
    fillRect(x + 14, y + 6, 42, 26, RED);
    fillRect(x + 14, y + 6, 42, 26, RED);
    // white cross bars on the flag
    hline(x + 14, y + 16, 42, 4, PAPER);
    vline(x + 32, y + 6, 26, 4, PAPER);
    fillRect(x + 6, y + 58, 56, 4, INK);
  } else if (kind === "mine") {
    fillTriangle(x + 6, y + 56, x + 32, y + 8, x + 58, y + 56, INK);
    fillTriangle(x + 32, y + 8, x + 44, y + 30, x + 32, y + 30, PAPER);
    fillRect(x + 4, y + 56, 56, 5, INK);
    fillCircle(x + 32, y + 26, 5, RED);
  }
}

// ---------------------------------------------------------------- page
function drawPage(): void {
  fillAll(PAPER);
  // Double outer border.
  rectOutline(14, 14, W - 28, H - 28, 4, INK);
  rectOutline(22, 22, W - 44, H - 44, 2, INK);

  // Masthead.
  drawTextCentered(512, 38, "THE WORLD TODAY", 8, INK);
  hline(40, 108, W - 80, 3, INK);
  drawTextCentered(512, 122, "THURSDAY, 26 NOVEMBER 2026", 3, INK);
  hline(40, 152, W - 80, 3, INK);

  // ---- Lead story: US tariffs -------------------------------------------
  const leadY = 168;
  drawText(40, leadY, "TRADE WAR ESCALATES", 2, RED);
  drawText(40, leadY + 34, "US HITS 14 PARTNERS", 5, INK);
  drawText(40, leadY + 78, "WITH NEW TARIFFS", 5, INK);
  drawText(40, leadY + 138, "CHINA +20%, EU 15% — BRAZIL SINGLED OUT", 2, INK);
  drawText(40, leadY + 160, "MARKETS FALL; HEARING SET FOR 25 JANUARY", 2, INK);
  drawText(40, leadY + 190, "SECTION 301 • SOME CHINESE GOODS TO 45% IN TOTAL", 2, INK);
  // Ship pictogram in a ruled box on the right.
  const boxX = 668;
  const boxY = leadY;
  const boxW = 316;
  const boxH = 236;
  rectOutline(boxX, boxY, boxW, boxH, 2, INK);
  drawShip(boxX + 8, boxY + 8, boxW - 16, boxH - 48);
  drawTextCentered(boxX + boxW / 2, boxY + boxH - 24, "GLOBAL TRADE", 2, INK);

  hline(40, 428, W - 80, 3, INK);

  // ---- Six-story grid: 2 columns x 3 rows ------------------------------
  type Cell = { kicker: string; h1: string; h2: string; deck: string; icon: string };
  const cells: Cell[] = [
    { kicker: "CAIRO", h1: "FUEL TANKER FIRE", h2: "KILLS AT LEAST 30", deck: "HIGHWAY BLAZE NEAR CAIRO", icon: "flame" },
    { kicker: "SUDAN", h1: "DRONE STRIKES KILL", h2: "19 CIVILIANS", deck: "ATTACKS IN BLUE NILE STATE", icon: "drone" },
    { kicker: "GAZA", h1: "AIRSTRIKE KILLS", h2: "SENIOR HAMAS OFFICIAL", deck: "OFFICIAL AND FAMILY KILLED", icon: "burst" },
    { kicker: "LEBANON", h1: "LEBANON PLANS SECOND", h2: "INTERNATIONAL AIRPORT", deck: "NEW AIRPORT PLANNED AT KLEIAT", icon: "plane" },
    { kicker: "NORTH KOREA", h1: "PYONGYANG EXPELS", h2: "SWISS DIPLOMAT", deck: "EXPULSION IN SANCTIONS ROW", icon: "flag" },
    { kicker: "INDONESIA", h1: "MINE FLOOD KILLS", h2: "NINE GOLD MINERS", deck: "FLOODING AT GOLD MINE", icon: "mine" },
  ];
  const cellW = 462;
  const cellH = 148;
  const gapX = 20;
  const gapY = 10;
  const gridY = 444;
  for (let i = 0; i < 6; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 40 + col * (cellW + gapX);
    const cy = gridY + row * (cellH + gapY);
    const c = cells[i];
    rectOutline(cx, cy, cellW, cellH, 2, INK);
    drawText(cx + 14, cy + 12, c.kicker, 2, RED);
    drawText(cx + 14, cy + 40, c.h1, 3, INK);
    drawText(cx + 14, cy + 70, c.h2, 3, INK);
    drawText(cx + 14, cy + 106, c.deck, 2, INK);
    drawIcon(c.icon, cx + cellW - 78, cy + 6);
  }

  // ---- Footer ------------------------------------------------------------
  hline(40, 922, W - 80, 3, INK);
  drawTextCentered(
    512,
    938,
    "ALSO: BANGLADESH RAISES GARMENT PAY 36% • MALAYSIA SUES GOOGLE FOR $146M",
    2,
    INK,
  );
  drawTextCentered(
    512,
    960,
    "BRITAIN MOVES MILITARY AIRCRAFT OVER DRONE THREATS • THANKSGIVING IN THE US",
    2,
    INK,
  );
  drawTextCentered(512, 984, "ALL STORIES FIRST REPORTED THURSDAY 26 NOVEMBER 2026", 2, RED);
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
