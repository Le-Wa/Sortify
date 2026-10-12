// Icônes de l'app (écran d'accueil, notifications) : une pochette Sortify orange à étoile.
// Usage : npm run try -- scripts/make-icons.mts
import sharp from "sharp";
import { coverJpegBase64 } from "@/lib/cover";
const jpg = Buffer.from(await coverJpegBase64({ name: "Sortify", sleeve_name: null, color: "#FF6A13", axis: "scène", shape: "starburst", outline: false, is_divers: false }), "base64");
for (const size of [192, 512, 180]) {
  const file = size === 180 ? "public/icons/apple-touch-icon.png" : `public/icons/icon-${size}.png`;
  await sharp(jpg).resize(size, size).png().toFile(file);
  console.log(file);
}
