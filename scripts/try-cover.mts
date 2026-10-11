// Essai du rendu des pochettes. Usage : tsx --conditions=react-server scripts/try-cover.mts <dossier sortie>
import { writeFileSync } from "node:fs";
import { coverJpegBase64 } from "@/lib/cover";

const out = process.argv[2];
const samples = [
  { name: "Soirée potes", sleeve_name: null, color: "#FF6A13", axis: "moment", shape: "starburst", is_divers: false, position: 0 },
  { name: "Rap français de plume", sleeve_name: "Rap de plume", color: "#2448D8", axis: "scène", shape: "triangle", is_divers: false, position: 2 },
  { name: "Focus sans paroles", sleeve_name: "Focus", color: "#111111", axis: "moment", shape: "drop", is_divers: false, position: 12 },
];
for (const s of samples) {
  const b64 = await coverJpegBase64(s);
  writeFileSync(`${out}/cover-${s.position}.jpg`, Buffer.from(b64, "base64"));
  console.log(s.name, Math.round(b64.length / 1024), "Ko en base64");
}
