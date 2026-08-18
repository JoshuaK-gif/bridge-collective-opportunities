// Render a cropped region of a PNG as fine ASCII art to read text.
// Usage: node read-text.mjs <png> x0 y0 x1 y1 [cols]
import fs from 'fs';
import zlib from 'zlib';

const f = process.argv[2];
const [x0, y0, x1, y1] = process.argv.slice(3, 7).map(Number);
const cols = parseInt(process.argv[7] || '160', 10);
const buf = fs.readFileSync(f);

let pos = 8, width = 0, height = 0, colorType = 0;
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
const channels = colorType === 6 ? 4 : 3;
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = width * channels;
const px = new Uint8Array(width * height * channels);
let off = 0, prev = Buffer.alloc(stride);
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
  px.set(row, y * stride);
  prev = row;
}

const cw = x1 - x0, ch = y1 - y0;
const rowsOut = Math.round((ch / cw) * cols * 0.5);
const ramp = ' .:-=+*#%@';
for (let r = 0; r < rowsOut; r++) {
  let line = '';
  for (let c = 0; c < cols; c++) {
    const x = x0 + Math.floor((c / cols) * cw);
    const y = y0 + Math.floor((r / rowsOut) * ch);
    const o = (y * width + x) * channels;
    const A = channels === 4 ? px[o + 3] : 255;
    if (A < 20) { line += ' '; continue; }
    const R = px[o], G = px[o + 1], B = px[o + 2];
    const lum = 0.299 * R + 0.587 * G + 0.114 * B;
    line += ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor((lum / 255) * (ramp.length - 1))))];
  }
  console.log(line);
}
