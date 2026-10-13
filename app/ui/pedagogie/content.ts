/**
 * Pédagogie de l'onboarding : les textes, au même endroit (mini-guide, « Comment ça marche »,
 * cartes d'attente, intro de la proposition, suite de la création, bienvenue).
 */

export interface Story {
  title: string;
  text: string;
  visual: "likes" | "bacs" | "choix" | "lundi";
}

/** Mini-guide en 4 écrans, avant de se connecter. */
export const STORIES: Story[] = [
  {
    title: "Tu likes.",
    text: "Tu continues d'aimer des titres sur Spotify, comme d'habitude. Sortify lit tes likes des deux dernières années : c'est ton goût d'aujourd'hui.",
    visual: "likes",
  },
  {
    title: "L'IA ouvre tes bacs.",
    text: "Elle écoute l'ensemble et imagine les bacs qui te ressemblent : des scènes (« Rap français ») et des ambiances (« Fin de nuit »). Un bac, c'est une playlist.",
    visual: "bacs",
  },
  {
    title: "Tu choisis.",
    text: "Garde, renomme, fusionne, retire, ajoute un bac sur mesure. Rien n'arrive dans Spotify avant ton feu vert, et tes playlists actuelles ne bougent pas.",
    visual: "choix",
  },
  {
    title: "Le lundi, ça range.",
    text: "Chaque lundi, tes nouveaux likes arrivent dans leurs bacs. Quand l'IA hésite, le titre t'attend dans « À trier ». Sans bac, il va dans la caisse Divers.",
    visual: "lundi",
  },
];

/** Les mots du disquaire. */
export const GLOSSARY: { word: string; meaning: string }[] = [
  { word: "Bac", meaning: "une playlist que Sortify remplit tout seul" },
  { word: "À trier", meaning: "les titres où l'IA hésite : tu tranches d'un geste" },
  { word: "Divers", meaning: "la caisse des titres sans bac, qui peut donner naissance à un nouveau bac" },
  { word: "Arrivage", meaning: "les likes de la semaine, rangés le lundi" },
];

/** Bon à savoir, avant de se connecter. */
export const GOOD_TO_KNOW: string[] = [
  "La première fois prend 10 à 20 minutes. Tu peux fermer l'app : ça continue sans toi.",
  "Tes playlists actuelles ne sont pas touchées. Les playlists Sortify seront visibles sur ton profil Spotify (tu peux les rendre privées dans Spotify).",
  "Première fois ? La personne qui t'invite doit d'abord ajouter ton compte Spotify à Sortify.",
];

/** Cartes qui défilent pendant l'attente, selon l'étape. */
export const WAIT_TIPS: Record<"likes" | "enrich" | "analyse", { title: string; text: string }[]> = {
  likes: [
    { title: "Pourquoi tes 1 000 derniers likes ?", text: "Tes likes récents disent ce que tu écoutes aujourd'hui. Si tu en as moins, on les prend tous." },
    { title: "Rien ne bouge chez toi", text: "Sortify lit tes likes. Il ne crée rien dans Spotify avant que tu valides tes bacs." },
  ],
  enrich: [
    { title: "On écoute chaque titre", text: "Pour chacun de tes likes, on note son genre, son énergie et son humeur. C'est ce que l'IA lira pour ranger." },
    { title: "Ton goût, pas une formule", text: "Pas de catégories toutes faites : tes bacs naissent de ce que tu écoutes vraiment." },
  ],
  analyse: [
    { title: "Scène et ambiance", text: "Un titre a sa scène (« Rap français ») et peut aussi vivre dans une ambiance (« Fin de nuit ») : il sera dans les deux playlists." },
    { title: "Rien n'est figé", text: "Tu pourras garder, renommer, fusionner ou retirer chaque bac, et en demander un sur mesure." },
    { title: "Tu lui apprends", text: "Chaque correction (« pas dans ce bac », « plutôt celui-là ») devient un exemple que l'IA relit à chaque tri." },
  ],
};

/** Après la création : ce qui se passe ensuite. */
export const NEXT_STEPS: { title: string; text: string }[] = [
  { title: "Lundi", text: "premier tri de tes nouveaux likes, vers 8 h" },
  { title: "Arrivages", text: "les likes de chaque semaine, et une playlist « Arrivage de la semaine »" },
  { title: "À trier", text: "les titres où l'IA hésite : un geste suffit" },
];
