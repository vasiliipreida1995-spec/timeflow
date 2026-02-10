#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node fix-mojibake-force.cjs <file.tsx>");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), target);
const src = fs.readFileSync(filePath, "utf8");

function fixWin1251Utf8(s) {
  const bytes = iconv.encode(s, "win1251");
  return iconv.decode(bytes, "utf8");
}

function countRS(s) {
  let c = 0;
  for (const ch of s) if (ch === "Р" || ch === "С") c++;
  return c;
}

// Берём только "подозрительные" последовательности кириллицы/пробелов/пунктуации
const re = /[А-Яа-яЁёРС][А-Яа-яЁёРС\s.,;:!?()«»"'\-–—/\\]{3,}/g;

let changed = 0;

const out = src.replace(re, (chunk) => {
  // признак mojibake: "Р" и "С" занимают заметную часть строки
  const rsBefore = countRS(chunk);
  const ratioBefore = rsBefore / chunk.length;

  if (ratioBefore < 0.12) return chunk; // если "Р/С" мало — не трогаем

  const fixed = fixWin1251Utf8(chunk);

  // если после фикса стало меньше Р/С — почти точно успех
  const rsAfter = countRS(fixed);
  const ratioAfter = rsAfter / Math.max(1, fixed.length);

  // защитные проверки
  if (fixed.includes("�")) return chunk;
  if (ratioAfter < ratioBefore * 0.5) {
    changed++;
    return fixed;
  }

  return chunk;
});

if (out !== src) fs.writeFileSync(filePath, out, "utf8");
console.log(`Done. Chunks fixed: ${changed}`);
console.log(`File: ${target}`);
