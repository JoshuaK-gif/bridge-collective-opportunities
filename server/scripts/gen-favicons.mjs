// Generate the complete favicon/icon set from a source PNG.
// - Letterboxes the source onto a square canvas (no cropping, no distortion)
// - Area-averages down to each target size (good quality for tiny icons)
// - Writes PNGs and a PNG-compressed .ico (works in all modern browsers + Windows)
// Usage: node gen-favicons.mjs <source.png> <outdir>
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// ---------------- PNG decode ----------------
function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`Unsupported colorType ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = Buffer.alloc(width * height * 4); // RGBA
  let off = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const ft = raw[off++];
    const row = Buffer.from(raw.subarray(off, off + stride));
    off += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let val;
      switch (ft) {
        case 0: val = row[x]; break;
        case 1: val = (row[x] + a) & 0xff; break;
        case 2: val = (row[x] + b) & 0xff; break;
        case 3: val = (row[x] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          val = (row[x] + pr) & 0xff; break;
        }
        default: val = row[x];
      }
      row[x] = val;
    }
    for (let x = 0; x < width; x++) {
      const s = x * channels, d = (y * width + x) * 4;
      px[d] = row[s];
      px[d + 1] = row[s + 1];
      px[d + 2] = row[s + 2];
      px[d + 3] = channels === 4 ? row[s + 3] : 255;
    }
    prev = row;
  }
  return { width, height, px };
}

// ---------------- Resize: letterbox to square + area-average ----------------
function letterboxToSquare(src, size) {
  const { width: sw, height: sh, px } = src;
  const scale = size / sw; // fit by width; banner is wider than tall
  const dh = Math.round(sh * scale);
  const out = Buffer.alloc(size * size * 4);
  const yOff = Math.floor((size - dh) / 2);
  for (let ty = 0; ty < size; ty++) {
    for (let tx = 0; tx < size; tx++) {
      const d = (ty * size + tx) * 4;
      // source region this target pixel covers
      const sx0 = (tx / size) * sw;
      const sx1 = ((tx + 1) / size) * sw;
      const sy0 = ((ty - yOff) / dh) * sh;
      const sy1 = ((ty + 1 - yOff) / dh) * sh;
      if (ty < yOff || ty >= yOff + dh || sx0 >= sw || sx1 <= 0) continue; // transparent padding
      const ix0 = Math.max(0, Math.floor(sx0)), ix1 = Math.min(sw, Math.ceil(sx1));
      const iy0 = Math.max(0, Math.floor(sy0)), iy1 = Math.min(sh, Math.ceil(sy1));
      let r = 0, g = 0, b = 0, aSum = 0, count = 0;
      for (let iy = iy0; iy < iy1; iy++) {
        const rowW = Math.min(ix1, sx1) - Math.max(ix0, sx0);
        const rowH = Math.min(iy1, sy1) - Math.max(iy0, sy0);
        const wt = rowW * rowH;
        if (wt <= 0) continue;
        for (let ix = ix0; ix < ix1; ix++) {
          const s = (iy * sw + ix) * 4;
          const A = px[s + 3];
          if (A === 0) continue;
          r += px[s] * A * wt;
          g += px[s + 1] * A * wt;
          b += px[s + 2] * A * wt;
          aSum += A * wt;
          count += wt;
        }
      }
      if (aSum > 0) {
        out[d] = Math.round(r / aSum);
        out[d + 1] = Math.round(g / aSum);
        out[d + 2] = Math.round(b / aSum);
        out[d + 3] = Math.min(255, Math.round((aSum / count) * 255 * (count / ((ix1 - ix0) * (iy1 - iy0)))));
      }
    }
  }
  return out;
}

// ---------------- PNG encode ----------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------------- ICO build (PNG-compressed entries) ----------------
function buildIco(sizes, pngs) {
  const count = sizes.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const entries = [];
  const blobs = [];
  let offset = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const s = sizes[i];
    const e = Buffer.alloc(16);
    e[0] = s === 256 ? 0 : s;
    e[1] = s === 256 ? 0 : s;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    blobs.push(pngs[i]);
    offset += pngs[i].length;
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

// ---------------- main ----------------
const srcPath = process.argv[2];
const outDir = process.argv[3] || 'public';
if (!srcPath) { console.error('Usage: node gen-favicons.mjs <source.png> <outdir>'); process.exit(1); }

const src = decodePng(fs.readFileSync(srcPath));
console.log(`source: ${src.width}x${src.height}`);

const SIZES = [16, 32, 48, 152, 167, 180, 192, 512];
const pngs = {};
for (const s of SIZES) {
  const rgba = letterboxToSquare(src, s);
  pngs[s] = encodePng(s, rgba);
  console.log(`generated ${s}x${s} (${pngs[s].length} bytes)`);
}

fs.mkdirSync(path.join(outDir, 'icons'), { recursive: true });
const files = {
  'favicon-16x16.png': pngs[16],
  'favicon-32x32.png': pngs[32],
  'favicon-48x48.png': pngs[48],
  'apple-touch-icon.png': pngs[180],
  'icons/icon-152x152.png': pngs[152],
  'icons/icon-167x167.png': pngs[167],
  'icons/icon-180x180.png': pngs[180],
  'icons/icon-192x192.png': pngs[192],
  'icons/icon-512x512.png': pngs[512],
  'favicon.ico': buildIco([16, 32, 48], [pngs[16], pngs[32], pngs[48]])
};
for (const [rel, data] of Object.entries(files)) {
  const p = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log(`wrote ${rel} (${data.length} bytes)`);
}
console.log('done.');
