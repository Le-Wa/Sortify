# Sortify — Direction visuelle (v0)

- **Retenue : piste C « Bacs de disquaire »** — playlists = intercalaires de bac (onglets décalés), typo condensée majuscules, « disques sur le comptoir » pour les titres à trier.
- **Pas encore finalisée** (« pas encore wow ») : palette, typo et détails à retravailler une fois les wireframes validés.
- Variantes explorées : C1 (palette riso de A), C2 (une couleur fixe par playlist), C3 (riso de nuit). Sources : `docs/design/pistes-v2/`.

## Première passe sur les 10 écrans (oct. 2026)

Sources : `docs/design/ecrans-v2/`.

- **Typo** : Archivo condensé 900 en capitales pour les titres et les intercalaires ; Archivo pour le texte ; DM Mono pour les chiffres, codes et étiquettes.
- **Fond** : gris clair `#ECEDE8`, encre `#111111`. Écrans « en coulisse » (analyse, création) en noir.
- **Une couleur fixe par bac** (soirée orange, dimanche rose, club cobalt, soul lilas, solaire jaune, afro turquoise, route noir, focus gris). Divers = carton kraft `#C9A878`.
- **Pochettes Sortify** : chaque bac a une pochette générée (couleur du bac, nom en capitales condensées, code catalogue `SRT·04`). Elle sert aussi de cover à la playlist Spotify.
- Métaphores : intercalaires à onglets décalés (Proposition, Bacs), « disques sur le comptoir » (À trier), caisse en carton (Divers), « on presse tes bacs » (Création).
- **Règle des pochettes générées** : le nom est ajusté automatiquement à la pochette (taille calculée selon la longueur du mot le plus long, jusqu'à 3 lignes). Au-delà, l'IA propose un nom court pour la pochette, le nom complet restant celui de la playlist.
- **Couleur des bacs** : attribuée automatiquement par Sortify, jamais choisie pendant l'onboarding. Pas de personnalisation de couleur en V1.
