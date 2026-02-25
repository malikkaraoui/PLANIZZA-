# Changelog

Toutes les modifications notables du projet sont documentees ici.
Format base sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.2.0] - 2026-01-31

### Ajouts
- Fusion page Live dans page Commandes : onglet "Nouvelle commande" pour prise de commande manuelle directement depuis /pro/commandes
- Composant ManualOrderForm compact (grille + panier lateral)
- Redirection /pro/live vers /pro/commandes

### Corrections
- Couleurs page commandes pizzaiolo corrigees (textes lisibles sur fond clair)
- CORS : ajout localhost:5175 et 127.0.0.1:5175 dans les origins autorisees des Cloud Functions

## [1.1.0] - 2026-01-29

### Ajouts
- Page avis pizzaiolo avec reponses aux commentaires et affichage public
- Lien dashboard Express Stripe personnalise par pizzaiolo (createLoginLink)
- Etape "ready" entre accepted et delivered dans le suivi commande
- Page custom AuthAction (verification email, reset password)
- Validation mot de passe robuste et email verification

### Corrections
- Fix transfert Stripe Connect : chemin DB corrige (public/trucks + ownerId)
- Fix double toast nouvelle commande pizzaiolo
- Fix CORS preview channels et notifications ready/delivered
- Fix affichage notation apres status delivered
- Ajout VITE_STRIPE_PUBLISHABLE_KEY aux workflows CI

## [1.0.0] - 2026-01-28

Baseline de production. Premiere version taguee.

### Contenu
- Dashboard client et pizzaiolo
- Systeme de commandes V1 + V2 (kitchen statuses)
- Paiement Stripe
- Carte Leaflet pour localisation camions
- Menu avec gestion des tailles et prix
- Suivi de commande temps reel (OrderTracking)
- Notation UX post-commande
- Espace pro : creation camion, gestion menu, statistiques
- ErrorBoundary global
- Workflow GitHub Actions : deploy prod (main) + preview (dev)
- Versioning SemVer mis en place
