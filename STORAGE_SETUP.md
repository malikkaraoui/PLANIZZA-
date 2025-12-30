# Configuration Firebase Storage - PLANIZZA

## ⚠️ Action requise

Firebase Storage n'est pas encore activé sur votre projet. Suivez ces étapes :

## 📋 Étapes d'activation

1. **Ouvrez la console Firebase**
   - Allez sur : https://console.firebase.google.com/project/planizza-ac827/storage

2. **Cliquez sur "Commencer" (Get Started)**
   - Dans la page Storage qui s'ouvre
   - Acceptez les règles par défaut

3. **Choisissez un emplacement**
   - Sélectionnez la région la plus proche (ex: `europe-west1` pour l'Europe)
   - ⚠️ **L'emplacement ne peut pas être changé après**

4. **Attendez la création**
   - Cela prend quelques secondes

5. **Déployez les règles**
   ```bash
   firebase deploy --only storage:rules
   ```

## ✅ Vérification

Une fois activé, vous pourrez :
- ✅ Uploader des images (logo, photos camion)
- ✅ Les images seront stockées dans Firebase Storage
- ✅ URLs publiques automatiques
- ✅ Limite de 5MB par image

## 📁 Structure des dossiers

```
storage/
  ├── logos/          # Logos des camions
  ├── trucks/         # Photos principales des camions
  └── uploads/        # Autres uploads
```

## 🔐 Règles de sécurité

Les règles sont dans `storage.rules` :
- ✅ **Lecture** : Publique (pour afficher les images)
- ✅ **Écriture** : Uniquement utilisateurs authentifiés
- ✅ **Limite** : 5MB max par fichier
- ✅ **Types** : JPG, PNG, WebP uniquement

## 🆘 Alternative temporaire (si Storage pas encore activé)

En attendant, vous pouvez :
1. Utiliser des URLs d'images hébergées ailleurs (Imgur, etc.)
2. Ou activer Storage dès maintenant (recommandé)

Une fois Storage activé, le composant ImageUploader fonctionnera automatiquement ! 🎉
