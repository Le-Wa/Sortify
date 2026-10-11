import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { inkFor, vinylShades } from "./bac-colors";
import { sleeveLayout } from "./sleeve-layout";

const SIZE = 640;
/** Limite Spotify pour une image de playlist (JPEG encodé en base64). */
const MAX_BYTES = 256 * 1024;

let fonts: Promise<{ display: Buffer; mono: Buffer }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/Archivo-Condensed62-Black.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/DMMono-Medium.ttf")),
  ]).then(([display, mono]) => ({ display, mono }));
  return fonts;
}

/** Pochette Sortify d'un bac, en JPEG encodé base64 (prête pour PUT /playlists/{id}/images). */
export async function coverJpegBase64(bac: { name: string; sleeve_name: string | null; color: string }): Promise<string> {
  const { display, mono } = await loadFonts();
  const label = bac.sleeve_name ?? bac.name;
  const { lines, fontSize, padding, small } = sleeveLayout(label, SIZE);
  const ink = inkFor(bac.color);
  const v = vinylShades(bac.color);

  const png = new ImageResponse(
    (
      <div style={{ width: SIZE, height: SIZE, position: "relative", display: "flex", background: bac.color, overflow: "hidden" }}>
        {/* Vinyle ton sur ton, plein (rond central et trou), qui dépasse en haut à droite. */}
        <div
            style={{
              position: "absolute",
              right: -SIZE * 0.22,
              top: -SIZE * 0.18,
              width: SIZE * 0.95,
              height: SIZE * 0.95,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: v.disc,
            }}
          >
            <div
              style={{
                width: SIZE * 0.32,
                height: SIZE * 0.32,
                borderRadius: "50%",
                background: v.label,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: bac.color }} />
            </div>
          </div>
        <div
          style={{
            position: "relative",
            width: SIZE,
            height: SIZE,
            padding,
            background: "transparent",
            color: ink,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontFamily: "DM Mono", fontSize: small, opacity: 0.85 }}>sortify</div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Archivo", fontSize, lineHeight: 0.94 }}>
            {lines.map((line, i) => (
              <span key={i}>{line.toUpperCase()}</span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      fonts: [
        { name: "Archivo", data: display, weight: 900, style: "normal" },
        { name: "DM Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
  const source = Buffer.from(await png.arrayBuffer());

  for (const quality of [88, 75, 60]) {
    const jpeg = await sharp(source).jpeg({ quality, mozjpeg: true }).toBuffer();
    const base64 = jpeg.toString("base64");
    if (base64.length <= MAX_BYTES) return base64;
  }
  throw new Error(`Pochette de « ${bac.name} » trop lourde pour Spotify`);
}
