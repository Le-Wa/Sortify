# Sortify — Roadmap UX/UI

Issu de l'audit du 2026-05-24. Chaque chantier ci-dessous est **autonome** : copie une section entière dans une nouvelle session Claude Sonnet pour la faire implémenter.

---

## Comment utiliser ce fichier

1. Choisis un chantier (par ordre de priorité ou selon ton humeur).
2. Copie son bloc entier (du `## Chantier X` jusqu'au `---` suivant) dans une nouvelle session.
3. Le bloc contient : contexte, fichiers concernés, brief, critères d'acceptation, branche suggérée.
4. Sonnet implémente, commit, et te rend la main pour merge.

**Conventions projet** (rappel) :
- Next.js 16 App Router, React 19, TypeScript strict
- Design system : tokens CSS dans `app/globals.css` (`--terra`, `--sage`, `--ink`...) + classes `s-*`
- Pas de Tailwind utility en dur dans les composants
- Mobile-first : zones tactiles 44px+, bottom sheet pour actions secondaires
- Toast pattern : `showToast()` (voir `PlaylistsClient.tsx`), pas d'`alert()`
- Commit après chaque tâche, branches préfixées `design/...`

---

## ✅ Déjà fait (branche `design/inbox-redesign`, mergée sur main le 2026-05-24)

- iframe Deezer → Spotify Embed public
- Slider confidence → 3 chips (Tous / Incertains <55% / Très incertains <40%)
- `alert()` → `showToast()` dans l'inbox

---

## Chantier P1 — Dashboard narratif

**Branche** : `design/dashboard-narrative`
**Effort** : ~1 jour
**Impact** : ★★★★ (réduit la charge cognitive à l'arrivée)

### Contexte
Le dashboard actuel (`app/dashboard/page.tsx` + `DashboardActions.tsx` + `DashboardInboxPreview.tsx`) affiche : greeting + H1 statique "Tout va bien tourner" + 4 StatCards égales + inbox preview + grid playlists + jauge valence. Hiérarchie plate, tout est au même poids visuel.

### Brief
Transforme le dashboard en page narrative orientée action :

1. **H1 dynamique** qui change selon l'état :
   - Si inbox > 0 : `"Tu as N titres qui t'attendent."` + bouton "Trier →" qui pointe vers `/inbox`
   - Si inbox = 0 et tracks récents classés : `"Tout est trié. Profite."`
   - Si compte neuf : `"Bienvenue. Lie ta première playlist."`
2. **Sous-titre** : afficher `Prochain tri auto · {date next monday} · 08h00` (réutilise `nextMonday()` de `app/ui/Navbar.tsx`)
3. **Phrase narrative pour le taux auto** : remplace la StatCard "Taux auto X%" par une phrase :
   - `"4 titres sur 5 sont rangés sans que tu y touches."` (calcul : `(imported - needs_review) / imported`)
4. **Profil émotionnel** : ajoute une phrase d'intro au-dessus de la barre :
   - `valence < 30` → `"Tes 30 derniers jours penchent vers la mélancolie."`
   - `valence 30-65` → `"Ton mood est resté équilibré ces 30 derniers jours."`
   - `valence > 65` → `"Tes 30 derniers jours étaient lumineux."`
5. **Garde** les 3 autres StatCards (Inbox, Classifiés, Importés) mais réduis-les visuellement (h: 64px, titre plus petit).

### Fichiers
- `app/dashboard/page.tsx` — H1, structure
- `app/dashboard/DashboardActions.tsx` — StatCards (réduire/réorganiser)
- Pas besoin de toucher l'API

### Critères d'acceptation
- [ ] H1 change selon `stats.needs_review`
- [ ] La phrase taux-auto s'affiche dynamiquement
- [ ] Profil émotionnel a une phrase d'intro contextualisée
- [ ] Mobile : la hiérarchie reste lisible (H1 ne fait pas 60px sur petit écran)
- [ ] `tsc --noEmit` passe

---

## Chantier P3 — Fiche playlist immersive

**Branche** : `design/playlist-detail-immersive`
**Effort** : ~2 jours
**Impact** : ★★★★ (quitte l'esthétique "admin tool")

### Contexte
`app/playlists/[id]/PlaylistDetailClient.tsx` affiche actuellement : breadcrumb "← Playlists", barre swatch 48×3px, H1 sobre, stats horizontales, filter chips, **table 4 colonnes** Track/Genres/Conf/Sync. Très "tableur".

### Brief
Reconçois la fiche comme un **lieu** qui reflète la couleur et l'identité de la playlist.

1. **Header hero** :
   - Fond gradient subtil basé sur `swatch` (la couleur de la playlist) :
     ```css
     background: linear-gradient(180deg, {swatch}15 0%, transparent 80%);
     ```
   - Padding header augmenté (32px top), H1 Fraunces 40px
   - Sous-titre (la description) éditable inline au clic (pas via bouton "Décrire")
2. **Stats vivantes** : remplace `"78 tracks · 75 syncés · 3 non syncés"` par :
   - `"78 titres · {N} nouveaux cette semaine · {M} en attente de sync"`
   - "Nouveaux cette semaine" = tracks avec `spotify_added_at > now - 7d`
3. **Abandon de la table** : passe à une liste de rows à la Spotify :
   - Row : `[index] [titre + artiste sur 2 lignes] [genres en chips alignés à droite] [conf en mini-bar 4px colorée] [sync icône ✓/○]`
   - Pas de cover album (pas dispo en DB, hors scope)
   - Hover row : `background: var(--surface2)`
4. **Cache** "Recompute centroïde" : déplace dans un sous-menu "Avancé" du bottom sheet, ou retire-le complètement de l'UI user (re-calcule auto au besoin).

### Fichiers
- `app/playlists/[id]/PlaylistDetailClient.tsx`
- Potentiellement ajouter une classe utilitaire dans `app/globals.css` pour le row musical

### Critères d'acceptation
- [ ] Le header a un gradient subtil de la couleur de la playlist
- [ ] La table a été remplacée par des rows
- [ ] La conf est une mini-bar visuelle, pas un %
- [ ] "Recompute centroïde" n'est plus exposé au premier niveau
- [ ] Le détail reste lisible sur mobile

---

## Chantier P4 — Navigation simplifiée

**Branche** : `design/nav-cleanup`
**Effort** : ~0.5 jour
**Impact** : ★★

### Contexte
Sidebar (`app/ui/Navbar.tsx`) : Dashboard / Inbox / Playlists / Archive / Paramètres / **Logs admin**. 6 entrées dont une admin exposée à tous.
Mobile (`app/ui/MobileNav.tsx`) : Home / Inbox / Playlists / Archive / Paramètres + Logout. "Home" vs "Dashboard" → vocabulaire incohérent.

### Brief
1. **Unifie le vocabulaire** : "Accueil" partout (remplace "Dashboard" et "Home").
2. **Cache "Logs admin"** : guard par rôle. Ajouter check `dbUser.is_admin` (vérifier si le champ existe en DB, sinon scope par email = `guts93@gmail.com`).
3. **Sidebar desktop** :
   - Top : Accueil · Inbox · Playlists · Archive
   - Footer (au-dessus du cron card) : un menu user avec avatar Spotify (`session.user.image`) qui ouvre un dropdown → Paramètres · (Logs si admin) · Déconnexion
4. **Mobile bottom nav** : Accueil · Inbox · Playlists · Profil (qui ouvre un bottom sheet avec Paramètres / Logout)
   - Retire "Archive" de la nav mobile (accessible via Playlists)

### Fichiers
- `app/ui/Navbar.tsx`
- `app/ui/MobileNav.tsx`
- Vérifier `lib/supabase/queries.ts` pour le check admin

### Critères d'acceptation
- [ ] Vocabulaire "Accueil" partout
- [ ] "Logs admin" caché pour les non-admins
- [ ] Mobile nav : 4 items + 1 profil (au lieu de 5 + logout)
- [ ] Pas de régression sur les liens existants

---

## Chantier P5 — Feedback et célébration

**Branche** : `design/feedback-celebration`
**Effort** : ~1 jour
**Impact** : ★★★ (engagement hebdo)

### Contexte
L'app est silencieuse. Toasts discrets, exit anim `scale(0.97)` 300ms, pas de feedback joyeux. Les actions répétitives (validate, sync all) manquent de récompense.

### Brief
1. **Confetti micro-anim** (CSS pur, pas de lib) quand l'inbox passe de N>0 à 0 (vide). Triggère depuis `app/inbox/inbox-list.tsx` quand `total` passe à 0 après une validation.
   - Exemple : 12 particules SVG colorées (terra, sage, amber) qui tombent + fade en 1.2s
2. **Toast enrichi** : après "Sync All" (`PlaylistsClient.tsx::syncAll`), remplace `"Sync terminé"` par :
   - `"5 → Late Night Drive · 3 → Workout · 2 → Sunday Morning"` avec les swatchs colorés
3. **Anim de transition track → playlist** : quand un track quitte l'inbox via "Valider", au lieu du fade scale, fais-le **glisser horizontalement** vers la droite (300ms ease-out) avant de disparaître. Donne l'impression que le track "va" vers sa playlist.
4. **(Optionnel)** Sons subtils opt-in : `<audio>` HTML5 avec un click léger sur validate. Toggle dans Paramètres.

### Fichiers
- `app/globals.css` — keyframes confetti, animation slide-out
- `app/inbox/inbox-list.tsx` — trigger confetti, animation track exit
- `app/playlists/PlaylistsClient.tsx` — toast enrichi

### Critères d'acceptation
- [ ] Confetti se déclenche une seule fois quand l'inbox se vide
- [ ] Sync All toast affiche le détail par playlist
- [ ] Anim track exit ne casse pas le scroll ni le layout

---

## Chantier P6 — Typo & contraste

**Branche** : `design/typo-contrast`
**Effort** : ~0.5 jour
**Impact** : ★★★ (accessibility + perceived quality)

### Contexte
- Body `font-weight: 300` partout, font-size 11-12px fréquent → fragile
- `--ink-dim` (#7a6a58) sous WCAG AA pour du body text sur fond `--bg` (#131110)
- Boutons à 12px, weight 400 → manquent de présence

### Brief
1. **Échelle typographique tokenisée** dans `:root` de `app/globals.css` :
   ```css
   --t-display: 36px;
   --t-title: 22px;
   --t-body: 14px;
   --t-meta: 12px;
   --t-micro: 11px;
   ```
2. **Body par défaut** : passe à `font-weight: 400` pour les textes < 14px. Garde 300 pour 16px+ et les titres Fraunces.
3. **Boutons** : `.s-btn` passe à `font-size: 13px`, `font-weight: 500`, `padding: 8px 16px`. `.s-btn-sm` reste 12/6px mais weight 500.
4. **Éclaircis `--ink-dim`** : passe de `#7a6a58` à `#9a8a72` (ratio de contraste 5.4:1 vs 4.1:1 actuel).
5. **`--ink-dimmer`** : ne plus l'utiliser pour du body text. Limite à séparateurs et placeholders.

### Fichiers
- `app/globals.css` — tokens, `.s-btn`
- Pas de modif composants nécessaire (les tokens cascadent)

### Critères d'acceptation
- [ ] Pas de régression visuelle majeure (vérifier dashboard, inbox, playlists, /)
- [ ] Boutons plus présents
- [ ] Contraste body text amélioré (peut tester avec devtools accessibility)

---

## Chantier P7 — Onboarding : premier tri démo

**Branche** : `design/onboarding-demo`
**Effort** : ~1.5 jour
**Impact** : ★★★ (rétention onboarding → user récurrent)

### Contexte
`app/onboarding/OnboardingClient.tsx` a 5 étapes (Connexion / Import / Playlists / Schedule / Prêt). Propre mais classique. L'utilisateur n'a pas de "moment magique".

### Brief
À l'étape 4 ou 5, lance un **premier tri en démo animée** pendant 6-8 secondes :

```
   Sortify analyse tes 47 derniers titres…

   ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  62%

   ↪ "Apologize" → Late Night Drive
   ↪ "Bad Habits" → Peak Hours
   ↪ "Coltrane" → Jazz & Soul
   ↪ "Daft Punk" → Workout
   ...
```

Quand c'est fini : *"23 titres classés en 8 secondes. Bienvenue."* + CTA "Voir mes playlists" → `/dashboard`.

**Important** : le tri doit être **réel** (lance vraiment la classification sur les tracks importés), pas une fake-anim. Utilise les endpoints existants (`/api/tracks/enrich` puis classification — voir comment fait `app/settings/SettingsClient.tsx::importAll`).

Affichage progressif des résultats via streaming OU polling de l'inbox toutes les 500ms.

### Fichiers
- `app/onboarding/OnboardingClient.tsx` — nouvelle étape
- Possiblement nouveau endpoint `/api/classify/run` si pas existant
- Vérifier : `lib/classifier/engine.ts`, `app/api/tracks/enrich/route.ts`

### Critères d'acceptation
- [ ] L'étape démo lance une vraie classification
- [ ] Les résultats apparaissent un par un (effet "live")
- [ ] Bouton "Passer" toujours dispo (pas bloquant)
- [ ] La phrase finale reflète le nombre réel classé

---

## Quick wins (≤ 1h chacun)

**Branche** : `design/quick-wins` (groupés en un seul commit ou un par un)

Chaque item peut être traité indépendamment :

1. **Renomme "Décrire"** → "Décrire la vibe" dans `app/playlists/PlaylistsClient.tsx:1264` (bouton inline row).
2. **Cache "Recompute centroïde"** : retire de l'UI user (`PlaylistsClient.tsx` dropdown desktop ligne ~1318 + bottom sheet ligne ~1089 + `PlaylistDetailClient.tsx::handleRecompute`).
3. **Empty states** : `PlaylistsClient.tsx:569` `"Aucune playlist active"` → ajouter CTA `"Lier ta première playlist Spotify"` qui ouvre le modal "Nouvelle". Idem `ArchiveClient.tsx:103`.
4. **Skeleton stat cards** : `DashboardActions.tsx:78` → utilise des bandes (3 lignes de hauteurs différentes) plutôt que des blocs pleins.
5. **Sidebar cron card** : `Navbar.tsx:163-202` → ajouter un Link "Modifier" qui pointe vers `/settings`.
6. **Bouton "+ Nouvelle" mobile** : `PlaylistsClient.tsx:560` → en `<= 640px`, en faire un FAB flottant en bottom-right (au-dessus de la mobile nav, donc `bottom: 80px`).
7. **Slider archive** : `ArchiveClient.tsx` — actuellement pas de filtres. Ajouter chip "Récents (<30j) / Tous".
8. **Lazy load** Spotify embed : ajouter `loading="lazy"` (déjà fait dans P2).

---

## Ordre de priorité recommandé

| # | Chantier | Effort | Impact |
|---|---|---|---|
| 1 | P1 Dashboard narratif | 1 j | ★★★★ |
| 2 | P3 Fiche playlist immersive | 2 j | ★★★★ |
| 3 | Quick wins (groupés) | 0.5 j | ★★★ |
| 4 | P6 Typo & contraste | 0.5 j | ★★★ |
| 5 | P5 Feedback & celebration | 1 j | ★★★ |
| 6 | P7 Onboarding démo | 1.5 j | ★★★ |
| 7 | P4 Nav simplifiée | 0.5 j | ★★ |
