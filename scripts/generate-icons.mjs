import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const shuttle = (stroke) => `
  <g fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.2 15.6 5.4 3.8c2.2-.9 4.4-1.3 6.6-1.3s4.4.4 6.6 1.3l-3.8 11.8"/>
    <path d="M12 15.4V2.6M10.6 15.5 8.6 3.1M13.4 15.5l2-12.4" opacity="0.75"/>
    <path d="M8.8 15.4h6.4v1.3a3.2 3.2 0 0 1-6.4 0z" fill="${stroke}"/>
  </g>`;

function icon(size, { padding, radius, background, glyph }) {
  const inner = size - padding * 2;
  const scale = inner / 24;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>
    <g transform="translate(${padding} ${padding}) scale(${scale}) rotate(-38 12 12)">${shuttle(glyph)}</g>
  </svg>`);
}

await mkdir("public/icons", { recursive: true });
const volt = "#c8f542";
const ink = "#17240f";

const jobs = [
  ["public/icons/icon-192.png", icon(192, { padding: 28, radius: 42, background: volt, glyph: ink })],
  ["public/icons/icon-512.png", icon(512, { padding: 72, radius: 112, background: volt, glyph: ink })],
  ["public/icons/icon-maskable-512.png", icon(512, { padding: 128, radius: 0, background: volt, glyph: ink })],
  ["src/app/icon.png", icon(512, { padding: 72, radius: 112, background: volt, glyph: ink })],
  ["src/app/apple-icon.png", icon(180, { padding: 26, radius: 40, background: volt, glyph: ink })],
];

for (const [file, svg] of jobs) {
  await sharp(svg).png().toFile(file);
  console.log(file);
}
