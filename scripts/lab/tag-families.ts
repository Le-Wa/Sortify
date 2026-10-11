// Grandes familles de genres, pour repérer un désaccord entre les tags Last.fm (souvent ceux de l'artiste) et Deezer.

const FAMILIES: [string, RegExp][] = [
  ["oriental", /raï|\brai\b|arab|maghreb|oriental|gnawa|chaabi|maghrib/],
  ["latino-caraïbes", /reggaeton|baile|carioca|brazil|brésil|latin|dancehall|reggae|\bdub\b|kuduro|cumbia|salsa|bachata|kompa|zouk|shatta|guaracha|caribbean|mpb|bossa|soca/],
  ["afro", /afro|african|africaine|amapiano|gqom|naija|highlife|coupé|ndombolo/],
  ["rap", /\brap|hip.?hop|trap|drill|grime|boom.?bap/],
  ["électro", /house|techno|electro|électro|electronic|dance|edm|garage|dubstep|trance|drum|dnb|jungle|\bbass|rave|breakbeat/],
  ["soul-rnb", /r&b|rnb|soul|(?<!baile )funk|neo.?soul/],
  ["jazz", /jazz|blues/],
  ["pop-rock", /pop|rock|indie|alternative|folk|chanson|singer|metal|punk/],
];

export function families(tags: string[]): Set<string> {
  const out = new Set<string>();
  for (const raw of tags) {
    const tag = raw.replace(/^deezer:/, "").toLowerCase();
    for (const [name, re] of FAMILIES) if (re.test(tag)) out.add(name);
  }
  return out;
}

/** Deezer et Last.fm ne partagent aucune famille (« pop » seul chez Deezer est trop vague pour trancher). */
export function contradicts(lastfm: string[], deezer: string[]): boolean {
  const a = families(lastfm);
  const b = families(deezer);
  if (!a.size || !b.size) return false;
  if (b.size === 1 && b.has("pop-rock")) return false;
  return ![...b].some((f) => a.has(f));
}
