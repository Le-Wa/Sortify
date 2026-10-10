# Sortify — Spec produit (v0, brouillon)

> Repartir de zéro. Ce document définit **à quoi sert l'app** avant tout écran ou choix visuel.
> Statut : à valider. Les points marqués ❓ attendent une décision.

## 1. Le problème

Je like des titres sur Spotify au fil de l'eau. Ils s'empilent dans « Titres likés » et ne finissent jamais dans mes playlists, parce que ranger à la main est pénible. Résultat : mes playlists se figent, mes likes deviennent un fourre-tout.

## 2. La promesse

**Tu likes, Sortify range.** Chaque nouveau like atterrit dans la bonne playlist, tout seul. Tu n'ouvres l'app que pour trancher quand elle hésite, ou pour réorganiser ta bibliothèque de temps en temps.

## 3. Pour qui

- Moi et quelques potes (≤ 25 comptes, mode développement Spotify suffit).
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
3. **Ajuster la proposition** — garder / retirer / renommer / « régénérer celle-ci ». Pas d'éditeur de règles.
4. **Création dans Spotify** — Sortify crée les playlists validées et les remplit avec mes likes existants.
5. **Tri quotidien automatique** des nouveaux likes + bouton « Trier maintenant ».
6. **Multi-playlists** — un titre va dans toutes les playlists où il a sa place (c'est le cœur de la valeur).
7. **À trier** — les titres incertains : extrait audio, suggestions, choisir, ignorer.
8. **Historique léger** — ce qui a été rangé récemment, avec annulation.
9. **Ré-analyse automatique** — quand Divers grossit autour d'une même direction (ou que tes likes dérivent), Sortify propose une nouvelle playlist sur l'Accueil : accepter / refuser.

### Hors V1
- Onboarding élaboré (chemins multiples, BYOK, import de playlists existantes, mode « from scratch » manuel)
- Stats, profil émotionnel, dashboards KPI
- Couleurs perso, réordonnancement, admin, personas, logs détaillés
- Landing page publique

## 7. Écrans (premier jet, sans design)

1. **Connexion** — logo, une phrase, « Se connecter avec Spotify ».
2. **Révélation** (une seule fois) — analyse en cours (avec du feedback, ça prend du temps) → « Voici l'âme de ta bibliothèque » : les playlists proposées → ajuster → créer.
3. **Accueil** — l'état en une phrase (« 3 titres à trier » / « Tout est rangé ») + les derniers rangements + accès aux playlists.
4. **À trier** — un titre à la fois (ou liste), extrait audio, suggestion + alternatives.
5. **Playlists** — liste des playlists gérées ; détail = titres récemment ajoutés + activer/désactiver + ré-apprendre.
6. **Réglages** — fréquence du tri, déconnexion.

Soit **5–6 écrans**, contre ~12 routes dans la version actuelle.

## 8. Décisions

- ✅ **Tri** : quotidien automatique + bouton « Trier maintenant ».
- ✅ **Multi-playlists** : oui, c'est la différence clé — 3 playlists max par titre.
- ✅ **Like original** : reste dans « Titres likés » (non destructif).
- 🟡 **Autonomie** : par défaut, Sortify range seul quand il est sûr et ne demande que pour les vrais doutes (cible : < 1 titre sur 5 en « À trier »). Réglable plus tard si besoin.
- ✅ **Connexion** : mini-explication en 3 étapes ; rassurance « Tes playlists actuelles ne sont pas touchées » ; accès des potes par code d'invitation.
- ✅ **Noms dans Spotify** : nom seul (« Soirée potes »), sans suffixe. Sortify garde la liste de ses playlists de son côté.
- ✅ **Raison de l'IA** dans « À trier » : sur demande (« Pourquoi ? » qui se déplie).
- ✅ **Ré-analyse** : automatique dès la V1 (voir point 9).
- ✅ **Like qui ne va nulle part** : va dans une playlist « Divers » (à rendre élégante côté design).

## 9. Étapes suivantes

1. Valider ce doc (sections 6 et 8).
2. Parcours détaillés + wireframes basse fidélité des 5–6 écrans.
3. Direction visuelle (page blanche) → 2–3 pistes à comparer.
4. Design system minimal → recode.
