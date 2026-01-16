# Photos de Pizza - Guide de Remplacement

## 📸 Photos Actuelles

Les photos de pizza sont actuellement des placeholders provenant d'Unsplash. Pour utiliser vos propres photos :

## 🎨 Option 1 : Générer avec l'IA

### Midjourney
```
/imagine prompt: professional food photography of [type] pizza, 
top view, rustic wood table, natural lighting, fresh ingredients, 
appetizing, 4k, high quality --ar 1:1
```

### DALL-E 3
```
Professional food photography of a [type] pizza on a rustic wooden table,
top-down view, natural lighting, fresh ingredients visible, 
appetizing presentation, high resolution, square format
```

### Stable Diffusion
```
professional food photography, [type] pizza, top view, 
wood table, natural light, fresh ingredients, 8k, masterpiece
```

## 📁 Option 2 : Utiliser vos Photos Locales

1. **Créez le dossier** :
   ```bash
   mkdir -p public/images/pizza-presets
   ```

2. **Ajoutez vos photos** nommées de `pizza-01.jpg` à `pizza-30.jpg`
   - Format recommandé : JPG ou WebP
   - Dimensions : 400x400px minimum (carré)
   - Poids : < 200KB par photo

3. **Modifiez le fichier** `src/features/menu/constants/pizzaPhotoPresets.js` :
   ```javascript
   {
     id: 'pizza-01',
     url: '/images/pizza-presets/pizza-01.jpg',  // ← Changez ici
     name: 'Margherita classique'
   }
   ```

## 🌐 Option 3 : URLs Externes

Vous pouvez utiliser n'importe quelle URL d'image :
- Unsplash
- Pexels
- Votre CDN
- Firebase Storage

Remplacez simplement l'URL dans `pizzaPhotoPresets.js`.

## ✅ Checklist Qualité Photo

- [ ] Format carré (1:1)
- [ ] Haute résolution (min 400x400)
- [ ] Bonne luminosité
- [ ] Vue de dessus (top-down) recommandée
- [ ] Fond neutre ou bois
- [ ] Pas de watermark
- [ ] Optimisée pour le web (< 200KB)

## 🎯 Types de Pizza à Photographier

1. Margherita classique
2. Pepperoni
3. Quatre fromages
4. Végétarienne
5. Chorizo piquant
6. Fruits de mer
7. Calzone
8. Regina (jambon champignons)
9. Napolitaine
10. Quatre saisons
11. Burrata
12. Jambon cru / Proscuitto
13. Chèvre miel
14. Saumon fumé
15. Truffe
16. Diavola (piquante)
17. Champignons
18. Bolognaise
19. Forestière
20. Paysanne
21. Orientale
22. Raclette
23. Tartiflette
24. Texane
25. Savoyarde
26. Campagnarde
27. Océane
28. Provençale
29. Sicilienne
30. Végétalienne

## 🔧 Optimisation des Images

### Avec ImageMagick :
```bash
convert input.jpg -resize 400x400^ -gravity center -extent 400x400 -quality 85 output.jpg
```

### Avec Node.js (Sharp) :
```javascript
const sharp = require('sharp');

sharp('input.jpg')
  .resize(400, 400, { fit: 'cover' })
  .jpeg({ quality: 85 })
  .toFile('output.jpg');
```

## 📝 Notes

- Les photos sont affichées dans un carrousel de 32 items (sans photo + 30 photos + upload personnel)
- L'URL de la photo sélectionnée est stockée dans le menu item
- Les pizzaiolos peuvent aussi uploader leur propre photo plus tard
