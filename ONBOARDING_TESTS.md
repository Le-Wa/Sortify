# Tests onboarding v2

Utiliser `/admin/personas` pour créer des personas de test.
Le bouton ⚡ dans S2 bypass l'OAuth Spotify en dev.

---

## Path A — BYOK

| # | Écran | Action | Attendu |
|---|-------|--------|---------|
| A1 | S0 | "Créer mon accès Spotify" | → S1 |
| A2 | S1 | "C'est fait" | → S2 |
| A3 | S2 | ⚡ Bypass | → S3, status in_progress |

## Path B — Invitation

| # | Écran | Action | Attendu |
|---|-------|--------|---------|
| B1 | S0 | "J'ai un code d'invitation" | → S-Invite |
| B2 | S-Invite | Code valide (générer via widget 👤 → 🎟) | → S3 |
| B3 | S-Invite | Code invalide | Message d'erreur |
| B4 | S-Invite | Code déjà utilisé | Message d'erreur |

## Path C — Mode Analyse

| # | Écran | Action | Attendu |
|---|-------|--------|---------|
| C1 | S3 | "Non" | → S-Analyse, job démarre |
| C2 | S-Analyse | "Entrer dans l'app maintenant" | → S-Preview in-app |
| C3 | S-Preview | Attendre | Bannière disparaît, status complete |

## Path D — Mode Import

| # | Écran | Action | Attendu |
|---|-------|--------|---------|
| D1 | S3 | "Oui" → "Importer" | → S4 |
| D2 | S4 | Sélectionner 0 playlists | Bouton "Importer" désactivé |
| D3 | S4 | Sélectionner playlists + valider | → S-Preview |
| D4 | S-Preview | Attendre | Bannière disparaît |

## Path E — Mode Scratch

| # | Écran | Action | Attendu |
|---|-------|--------|---------|
| E1 | S3 | "Oui" → "Nouvelle organisation" | → S6 |
| E2 | S6 | Nom vide | Bouton désactivé |
| E3 | S6 | Nom rempli + valider | → S7 |
| E4 | S7 | Valider sans vibe ni artistes | → S-Preview |
| E5 | S7 | "Ajouter une autre playlist" | → S6 (2ème playlist) |
| E6 | S-Preview | Attendre | Bannière disparaît, status complete |

## Path F — Reprise après interruption

| # | Scénario | Attendu |
|---|----------|---------|
| F1 | Persona status=pending, step=0 | Atterrit sur S0 (landing) |
| F2 | Persona status=in_progress, step=0 | Atterrit sur S3 |
| F3 | Persona status=in_progress, step=2 | Atterrit sur S-Preview |

## Path G — Navigation

| # | Scénario | Attendu |
|---|----------|---------|
| G1 | Bouton ← sur chaque écran | Retour à l'écran précédent |
| G2 | User déjà complete accède à /onboarding | Redirect → /dashboard |
| G3 | User non auth accède à /dashboard | Redirect → /onboarding (S0) |

---

## Statut

| Path | Statut |
|------|--------|
| A | ⬜ |
| B | ⬜ |
| C | ⬜ |
| D | ⬜ |
| E | ⬜ |
| F | ⬜ |
| G | ⬜ |
