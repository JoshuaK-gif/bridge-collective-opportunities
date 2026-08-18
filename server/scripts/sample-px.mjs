// Sample specific pixels of a PNG to identify colors.
// Usage: node sample-px.mjs <png> x1,y1 x2,y2 ...
import fs from 'fs';
import zlib from 'zlib';

const f = process.argv[2];
const pts = process.argv.slice(3).map(s => s.split(',').map(Number));
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
for (const [x, y] of pts) {
  const o = (Math.round(y) * width + Math.round(x)) * channels;
  const A = channels === 4 ? px[o + 3] : 255;
  console.log(`(${x},${y}) -> rgba(${px[o]},${px[o + 1]},${px[o + 2]},${A})`);
}
