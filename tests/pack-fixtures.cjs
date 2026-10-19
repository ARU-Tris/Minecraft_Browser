'use strict';
const { deflateRawSync, deflateSync } = require('node:zlib');
const { crc32 } = require('../design/resource-pack-model.js');
function zip(entries, compression = 8) {
  const locals = [], central = []; let offset = 0;
  for (const [name, value] of entries) {
    const filename = Buffer.from(name), data = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
    const compressed = compression === 8 ? deflateRawSync(data) : data, local = Buffer.alloc(30), directory = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(compression, 8); local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(compression, 10); directory.writeUInt32LE(crc32(data), 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    locals.push(local, filename, compressed); central.push(directory, filename); offset += local.length + filename.length + compressed.length;
  }
  const local = Buffer.concat(locals), directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, directory, end]);
}
function png(width = 16, height = 16, color = [20, 200, 80, 255]) {
  const chunk = (type, data) => { const head = Buffer.alloc(4), tail = Buffer.alloc(4), name = Buffer.from(type); head.writeUInt32BE(data.length); tail.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([head, name, data, tail]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const rgba = typeof color === 'function' ? color(x, y) : color; for (let c = 0; c < 4; c++) raw[y * (width * 4 + 1) + 1 + x * 4 + c] = rgba[c]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const meta = { pack: { min_format: 84, max_format: [97, 1], description: 'Pack test' } };
const file = (entries, compression = 8, name = 'Pack Test.zip') => new File([zip(entries, compression)], name);
module.exports = { zip, png, meta, file };
