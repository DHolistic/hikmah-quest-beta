import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "native-web");
const include = [
  "beta",
  "assets",
  "icons",
  "index.html",
  "manifest.json",
  "quran-repository.json",
  "card-back.avif",
  "card-back.png",
  "sw.js",
];

async function rmSafe(target) {
  await fs.rm(target, { recursive: true, force: true });
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function copyItem(relPath) {
  const src = path.join(root, relPath);
  const dest = path.join(outDir, relPath);
  const stats = await fs.stat(src);

  if (stats.isDirectory()) {
    await ensureDir(dest);
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyItem(path.join(relPath, entry));
    }
    return;
  }

  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

await rmSafe(outDir);
await ensureDir(outDir);

for (const relPath of include) {
  await copyItem(relPath);
}

console.log(`Prepared native web bundle at ${outDir}`);
