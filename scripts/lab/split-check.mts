// Vérifie la coupe des noms de bacs sur les pochettes.
import { splitLines } from "@/lib/sleeve-layout";
for (const n of ["Afrobeats", "Divers", "Caraïbes", "Warehouse", "Mélancolie", "Techno", "Soul nocturne", "Afrohouse", "Introspection", "Nocturnes"]) console.log(n, "→", splitLines(n).join(" / "));
