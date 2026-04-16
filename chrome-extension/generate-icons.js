/**
 * Run this script with Node.js to generate placeholder icons:
 *   node generate-icons.js
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPNG(width, height, r, g, b) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      let isLetter = false;
      // Draw a "P" shape
      if (nx >= 0.25 && nx <= 0.40 && ny >= 0.15 && ny <= 0.85) isLetter = true;
      if (nx >= 0.25 && nx <= 0.65 && ny >= 0.15 && ny <= 0.30) isLetter = true;
      if (nx >= 0.60 && nx <= 0.75 && ny >= 0.15 && ny <= 0.55) isLetter = true;
      if (nx >= 0.25 && nx <= 0.65 && ny >= 0.45 && ny <= 0.55) isLetter = true;
      if (isLetter) {
        rawData[offset++] = 255; rawData[offset++] = 255;
        rawData[offset++] = 255; rawData[offset++] = 255;
      } else {
        rawData[offset++] = r; rawData[offset++] = g;
        rawData[offset++] = b; rawData[offset++] = 255;
      }
    }
  }
  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crcVal]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

[16, 48, 128].forEach(size => {
  const png = createPNG(size, size, 79, 70, 229);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath}`);
});

console.log('Done! Icons created.');
