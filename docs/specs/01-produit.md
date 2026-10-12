# Sortify — Spec produit (v0, brouillon)

> Repartir de zéro. Ce document définit **à quoi sert l'app** avant tout écran ou choix visuel.
> Statut : à valider. Les points marqués ❓ attendent une décision.

## 1. Le problème

Je like des titres sur Spotify au fil de l'eau. Ils s'empilent dans « Titres likés » et ne finissent jamais dans mes playlists, parce que ranger à la main est pénible. Résultat : mes playlists se figent, mes likes deviennent un fourre-tout.

## 2. La promesse

**Tu likes, Sortify range.** Chaque nouveau like atterrit dans la bonne playlist, tout seul. Tu n'ouvres l'app que pour trancher quand elle hésite, ou pour réorganiser ta bibliothèque de temps en temps.

## 3. Pour qui

- Moi et quelques potes (5 comptes au plus sur l'app Spotify de Sortify en mode développement ; au-delà, chacun sa propre app via « Power user »).
- Pas de landing marketing, pas de pricing, pas d'onboarding « produit ».
- **Principe directeur : simple et fini > léché et inachevé.** Toute feature qui ralentit la V1 sort du périmètre.

## 4. Rapport à l'app

Entre *invisible* et *rituel occasionnel* :

| Moment | Fréquence | Ce que fait l'utilisateur |
|---|---|---|
| Tri automatique | En continu / périodique, sans moi | Rien |
| Trancher les doutes | Quand il y en a (quelques fois par mois) | Valider ou corriger 2–10 titres |
| Ajuster la biblio | Rarement | Ajouter/retirer une playlist gérée, corriger sa « définition » |

Conséquence design : **chaque ouverture doit répondre en 2 secondes à « y a-t-il quelque chose à faire ? »**, puis laisser repartir.

## 5. Boucle principale

```
like sur Spotify ─► Sortify détecte ─► classe
                                        ├─ sûr      ─► ajouté à la playlist (rien à faire)
                                        └─ incertain ─► file « À trier » ─► je tranche en 1 geste
```

## 6. Périmètre V1

**Je ne définis pas mes playlists : l'IA le fait.** Elle analyse ma bibliothèque et me dit « voici les ~10 playlists qui représentent l'âme de ta bibliothèque » — un mix de genres, de thèmes, d'ambiances et de moments (ex. « Soirée potes, énergique », « Dimanche décontracté », « Rap introspectif »). Moteur détaillé : [02-moteur-ia.md](02-moteur-ia.md).

### Dans la V1
1. **Connexion Spotify** — 3 étapes d'explication + un bouton. Les nouveaux entrent un **code d'invitation** (généré par toi dans Réglages ; l'ajout du compte dans le dashboard Spotify reste manuel en mode dev).
2. **Analyse IA de la bibliothèque** — lit mes likes des 2 dernières années, propose les playlists qui la résument — nombre libre selon sa taille et ses directions (nom + description en une phrase + quelques titres exemples).
3. **Ajuster la proposition** — garder / retirer / renommer / « autre idée » / fusionner deux bacs. Champ « Il manque un bac ? » pour en demander un en texte libre. Chaque bac affiche son type (scène / ambiance / moment) et 5 pochettes d'exemple. Fusion : l'IA réécrit la fiche et propose un nom. Toucher une pochette lance un extrait. Pas d'éditeur de règles.
4. **Création dans Spotify** — Sortify crée les playlists validées et les remplit avec mes likes existants ; on voit chaque bac se remplir, puis « Voir mes bacs » → Accueil.
5. **Tri quotidien automatique** des nouveaux likes + bouton « Trier maintenant ».
6. **Multi-playlists** — un titre va dans toutes les playlists où il a sa place (c'est le cœur de la valeur).
7. **À trier** — un titre à la fois : suggestions pré-cochées (3 bacs max), extrait au tap, « Pourquoi ? » sur demande. Swipe droite = ranger, swipe gauche = Divers ; boutons équivalents. Pas de « Passer » : « Je ne sais pas » = Divers. Bouton « Accepter les N suggestions » quand plusieurs titres attendent.
8. **Historique léger** — ce que le dernier tri a rangé, affiché sur l'Accueil ; « Corriger » ouvre directement le choix des bacs.
9. **Ré-analyse automatique** — quand Divers grossit autour d'une même direction (ou que tes likes dérivent), Sortify propose une nouvelle playlist sur l'Accueil : accepter / refuser.

### Hors V1
- Onboarding élaboré (chemins multiples, BYOK, import de playlists existantes, mode « from scratch » manuel)
- Stats, profil émotionnel, dashboards KPI
- Couleurs perso, admin, personas, logs détaillés
- Landing page publique

## 7. Écrans (premier jet, sans design)

1. **Connexion** — logo, une phrase, « Se connecter avec Spotify ».
2. **Révélation** (une seule fois) — analyse en cours (avec du feedback, ça prend du temps) → « Voici l'âme de ta bibliothèque » : les playlists proposées → ajuster → créer.
3. **Accueil** — l'état en une phrase (+ rangée d'intercalaires vers les bacs) (« 3 titres à trier » / « Tout est rangé ») + les derniers rangements + accès aux playlists.
4. **À trier** — un titre à la fois (ou liste), extrait audio, suggestion + alternatives.
5. **Bacs** — liste des bacs gérés, dans un ordre réglable (↑↓) qui est aussi celui de la rangée de bacs sur l'Accueil. Divers est un objet à part, « la caisse » (« 61 titres attendent leur bac ») ; on peut y ranger un titre à la main dans un bac. Détail : la fiche IA d'abord (modifiable en texte libre ou « demande à l'IA »), puis les ajouts récents avec « Retirer » (exemple négatif pour l'IA ; s'il n'est dans aucun autre bac, il part dans Divers), les titres exemples, activer/désactiver.
6. **Réglages** — heure du tri quotidien, pause du tri, suggestions de nouveaux bacs, relancer l'analyse, inviter un pote (code), supprimer mes données (les playlists restent dans Spotify), déconnexion.

Soit **5–6 écrans**, contre ~12 routes dans la version actuelle.

## 8. Décisions

- ✅ **Tri** : quotidien automatique + bouton « Nouveaux likes ? ». Plan Vercel Hobby : un seul cron par jour, à la même heure pour tout le monde (6 h UTC, soit 8 h l'été et 7 h l'hiver à Paris) ; pas de choix d'heure dans les Réglages (oct. 2026).
- ✅ **Multi-playlists** : oui, c'est la différence clé.
- 🟡 **Limite de 3 bacs par titre** : remise en question (oct. 2026). Aujourd'hui appliquée au rangement IA, à « À trier », aux corrections et au rangement depuis Divers, mais pas à la création d'un bac après coup (un titre peut alors en avoir 4 ou plus). Un nouveau bac garde les titres dans leurs autres bacs (pas d'« aspiration »), seul Divers est vidé.
- ✅ **Like original** : reste dans « Titres likés » (non destructif).
- 🟡 **Autonomie** : par défaut, Sortify range seul quand il est sûr et ne demande que pour les vrais doutes (cible : < 1 titre sur 5 en « À trier »). Réglable plus tard si besoin.
- ✅ **Connexion** : mini-explication en 3 étapes ; rassurance « Tes playlists actuelles ne sont pas touchées » ; accès des potes par code d'invitation.
- ✅ **Analyse** : on feuillette les vraies pochettes pendant l'attente ; on peut quitter et revenir.
- ✅ **Erreurs Spotify** à la création : réessai silencieux, signalé seulement si ça échoue encore au tri suivant.
- ✅ **Relancer l'analyse** (Réglages) : l'IA peut proposer d'ajouter, supprimer ou fusionner des bacs ; chaque changement est validé.
- ✅ **Invitation** : pas de saisie d'email ; le code est suivi de la connexion Spotify. ⚠️ À vérifier au code : le comportement de Spotify pour un compte pas encore autorisé (mode dev).
- ✅ **Ordre des titres** dans les playlists Spotify : les nouveaux titres sont ajoutés en haut.
- ✅ **Noms dans Spotify** : nom seul (« Soirée potes »), sans suffixe. Sortify garde la liste de ses playlists de son côté.
- ✅ **Raison de l'IA** dans « À trier » : sur demande (« Pourquoi ? » qui se déplie).
- ✅ **Ré-analyse** : automatique dès la V1 (voir point 9).
- ✅ **Like qui ne va nulle part** : va dans une playlist « Divers » (à rendre élégante côté design).

## 9. Étapes suivantes

1. Valider ce doc (sections 6 et 8).
2. Parcours détaillés + wireframes basse fidélité des 5–6 écrans.
3. Direction visuelle (page blanche) → 2–3 pistes à comparer.
4. Design system minimal → recode.
