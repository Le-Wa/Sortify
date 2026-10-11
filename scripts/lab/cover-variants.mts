// Planche des pochettes de tous les bacs actifs, telles qu'envoyées à Spotify (+ rangée miniature).
// Usage : npm run try -- scripts/lab/cover-variants.mts <dossier>
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { coverJpegBase64 } from "@/lib/cover";
import { db } from "@/lib/db";

const out = process.argv[2];
const { data: bacs, error } = await db()
  .from("bacs")
  .select("name, sleeve_name, color, axis, shape, is_divers, position")
  .eq("status", "active")
  .order("position");
if (error) throw new Error(error.message);
const T = 200, G = 14, COLS = 7, MINI = 56;
const list = bacs ?? [];
const rows = Math.ceil(list.length / COLS);
const tiles = [];
for (const [i, bac] of list.entries()) {
  const jpg = Buffer.from(await coverJpegBase64(bac), "base64");
  tiles.push({ input: await sharp(jpg).resize(T, T).toBuffer(), left: G + (i % COLS) * (T + G), top: G + Math.floor(i / COLS) * (T + G) });
  // Taille d'une pochette dans une liste Spotify.
  tiles.push({ input: await sharp(jpg).resize(MINI, MINI).toBuffer(), left: G + i * (MINI + 8), top: G + rows * (T + G) + 4 });
}
const sheet = await sharp({ create: { width: G + COLS * (T + G), height: G + rows * (T + G) + MINI + G * 2, channels: 3, background: "#ECEDE8" } })
  .composite(tiles)
  .png()
  .toBuffer();
writeFileSync(`${out}/covers.png`, sheet);
console.log("ok");
