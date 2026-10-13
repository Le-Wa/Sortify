# Importer ses playlists Spotify à l'onboarding — workflow, impact, maintenance (13 oct. 2026)

Questions de Walid : quel workflow, quel impact, quelle maintenance, et que faire quand l'IA n'est pas d'accord parce qu'une playlist est très large ?

## Contraintes
- API Spotify en mode développement : on ne lit les titres que des playlists que la personne **possède** (ou co-édite). Les playlists suivies (Spotify, potes) sont exclues.
- Les playlists de la personne sont publiques ou non, on ne peut pas changer ça (voir `public: false` ignoré).
- Sortify ne range que des **likes** : un titre de playlist qui n'est pas liké ne sera jamais rangé par le tri.

## Le parcours proposé

1. Import des likes (inchangé).
2. **« Tes playlists »** (nouvel écran de la Révélation) : la liste de ses playlists de 15 titres ou plus, avec pochette et nombre de titres. Elle coche celles qui sont de vrais « bacs » pour elle. Passable.
3. Pour chaque playlist cochée : une fiche écrite par l'IA à partir de ses titres (Opus, ~0,3 $ par playlist), plus un **test de cohérence** (voir plus bas).
4. Analyse du reste : l'IA cherche des bacs pour les likes qui ne sont dans aucune playlist cochée, sans doubler les fiches reprises (comme la passe « compléter »). Moins de bacs à inventer : l'analyse peut coûter un peu moins.
5. Proposition : les bacs repris portent l'étiquette « ta playlist », puis les bacs proposés. Mêmes retouches qu'aujourd'hui.

## Ce que devient une playlist reprise : 3 façons

| | A. Sortify la remplit | B. Copie Sortify (recommandé pour commencer) | C. Simple indice |
|---|---|---|---|
| Ce qui se passe | Le bac écrit dans **sa** playlist : ses nouveaux likes y arrivent | Un bac Sortify neuf, avec la fiche de sa playlist ; l'originale n'est pas touchée | L'analyse sait que la personne range « comme ça », sans lien ensuite |
| Impact pour la personne | Le plus magique : sa playlist vit toute seule | Clair et sans risque ; deux playlists proches dans Spotify | Invisible, mais des bacs plus fidèles |
| Risque | Sortify écrit dans une playlist qu'elle a construite à la main ; une erreur de rangement s'y voit | Doublon (elle peut supprimer l'originale) | Aucun |
| Maintenance | La plus lourde : elle continue d'éditer à la main → Sortify doit relire la playlist (ajouts = exemples appris, retraits = contre-exemples) ; titres non likés à ignorer | Comme un bac normal | Aucune |
| Effort | 3–4 j | 2–3 j | 1 j |

A peut venir ensuite, en option par playlist (« Laisser Sortify la remplir »), une fois B éprouvé. Les ajouts faits à la main dans la playlist deviendraient alors une source d'apprentissage précieuse.

## Playlist trop large : quand l'IA n'est pas d'accord

Exemple : « Mes sons » (800 titres, rap + afro + électro). Une fiche écrite pour elle serait floue et rangerait mal.

**Test de cohérence** (à l'étape 3, ~0,1 $ par playlist) : on fait ranger un échantillon des titres de la playlist avec la fiche obtenue et les autres bacs. Si moins de ~60 % de ses propres titres y retournent, elle est trop large (indice moins cher sans IA : aucune famille de genre ne dépasse la moitié des titres).

Alors on ne force pas, on propose :
- **La découper** : « Ta playlist “Mes sons” mélange 3 directions : Rap FR (310), Afro (190), Électro (120). En faire 3 bacs ? » ;
- **La garder comme indice** (C) : elle guide l'analyse sans devenir un bac ;
- **La laisser de côté**.

Le choix reste à la personne ; l'IA dit seulement ce qu'elle voit, avec les chiffres.

## Questions à trancher avant la planche
1. Façon de reprendre : B seulement d'abord, ou B + l'option A dès le départ ?
2. Playlist trop large : découpage proposé par défaut, ou indice par défaut ?
3. Seuil : à partir de combien de titres une playlist est proposée (15 ?) et combien au plus (10 playlists ?) pour borner le coût (~0,4 $ par playlist avec le test) ?
