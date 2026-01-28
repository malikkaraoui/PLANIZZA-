# Fix du site blanc en production

## Diagnostic
L'erreur `undefined is not an object (evaluating 'vs.ActivityBy')` indique un problème de module bundlé en production.

## Causes possibles
1. Cache Firebase Hosting
2. Déploiement incomplet
3. Conflit de versions entre fichiers déployés

## Solution - Étapes à suivre

### 1. Nettoyer complètement l'environnement

```bash
# Nettoyer le cache et les builds
rm -rf dist/
rm -rf node_modules/.vite
npm cache clean --force
```

### 2. Rebuild complet

```bash
# Rebuild from scratch
npm run build
```

### 3. Vérifier le build localement

```bash
# Tester le build en local
npm run preview
# Ouvrir http://localhost:4173/ et vérifier que ça marche
```

### 4. Redéployer sur Firebase

```bash
# Déployer avec cache clear
firebase deploy --only hosting --force
```

### 5. Vider le cache Firebase CDN

**Attendre 5-10 minutes** ou forcer le vidage du cache :
- Aller sur Firebase Console > Hosting
- Version actuelle > Menu ⋮ > Invalidate CDN cache

### 6. Test en production

- Ouvrir en navigation privée : https://votre-app.web.app
- Hard refresh (Cmd+Shift+R sur Mac)

## Si le problème persiste

### Option A: Vérifier les headers de cache

Vérifier que `firebase.json` a bien :

```json
{
  "hosting": {
    "headers": [
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-store, no-cache, must-revalidate, max-age=0"
          }
        ]
      }
    ]
  }
}
```

### Option B: Downgrade React Router (si nécessaire)

La version React Router 7.11 est très récente et peut avoir des bugs.

```bash
npm install react-router-dom@^6.28.0
npm run build
firebase deploy --only hosting
```

## Commandes rapides

```bash
# Full cleanup + rebuild + deploy
rm -rf dist/ node_modules/.vite && \
npm run build && \
firebase deploy --only hosting --force
```
