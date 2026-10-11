// Planche de pochettes (style actuel) sur quelques bacs réels. Usage : npm run try -- scripts/lab/cover-variants.mts <dossier>
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BAC_COLORS, DIVERS_COLOR } from "@/lib/bac-colors";
import { coverJpegBase64 } from "@/lib/cover";

const out = process.argv[2];
const names = ["Soul nocturne", "Afrobeats", "Techno mélodique", "House solaire", "Rap français", "Caraïbes & latino", "Groove joyeux", "Fin de nuit", "Jazz groove", "Divers"];
const colors = [...BAC_COLORS.map((c) => c.bg), DIVERS_COLOR.bg];
const T = 240, G = 14, COLS = 5;
const tiles = [];
for (const [i, name] of names.entries()) {
  const jpg = Buffer.from(await coverJpegBase64({ name, sleeve_name: null, color: colors[i % colors.length] }), "base64");
  tiles.push({ input: await sharp(jpg).resize(T, T).toBuffer(), left: G + (i % COLS) * (T + G), top: G + Math.floor(i / COLS) * (T + G) });
}
const rows = Math.ceil(names.length / COLS);
const sheet = await sharp({ create: { width: G + COLS * (T + G), height: G + rows * (T + G), channels: 3, background: "#ECEDE8" } })
  .composite(tiles)
  .png()
  .toBuffer();
writeFileSync(`${out}/cover-variants.png`, sheet);
console.log("ok");
