# Module Menu - Architecture et Utilisation

Ce module contient toute la logique métier pour la gestion du menu, du panier et de la personnalisation des items.

## 📁 Structure

```
src/features/menu/
├── constants/           # Constantes et configuration
│   ├── ingredients.js   # Liste des ingrédients disponibles
│   ├── menuConfig.js    # Configuration (TVA, types, catégories)
│   └── index.js        # Export centralisé
├── hooks/              # Hooks React réutilisables
│   ├── useLiveCart.js  # Gestion panier mode Live (pizzaiolo)
│   ├── useLiveOrder.js # Sync Firebase temps réel
│   ├── useMenuItem.js  # État et interactions d'un item
│   ├── usePizzaCustomization.js # Personnalisation pizzas
│   └── index.js        # Export centralisé
├── utils/              # Utilitaires purs
│   ├── menuHelpers.js  # Filtrage, formatage, helpers menu
│   ├── priceCalculations.js # Calculs de prix
│   └── index.js        # Export centralisé
└── index.js            # Export centralisé du module complet
```

## 🎯 Objectifs

1. **Réutilisabilité** : Partager la logique entre Live.jsx et Menu.jsx
2. **Maintenabilité** : Code organisé et facile à modifier
3. **Testabilité** : Fonctions pures et hooks découplés
4. **Performance** : Éviter les duplications et optimiser les calculs

## 🔧 Hooks

### `useLiveCart()`
Gère le panier en mode Live (pizzaiolo).
- Persistance localStorage automatique
- Ajout/retrait/suppression d'items
- Calcul du total
- Compatible avec personnalisation

```jsx
const {
  cart,                  // Array des items
  customerName,          // Nom du client
  setCustomerName,
  addToCart,            // (item, size?, customization?)
  removeFromCart,       // (itemId)
  deleteFromCart,       // (itemId)
  clearCart,
  totalCents,
  itemCount
} = useLiveCart();
```

### `usePizzaCustomization()`
Gère la personnalisation d'une pizza (ajout/retrait d'ingrédients).

```jsx
const {
  customizingPizza,        // Pizza en cours de personnalisation
  startCustomization,      // (item, size)
  cancelCustomization,
  toggleRemoveIngredient,  // (ingredient)
  toggleAddIngredient,     // (ingredient)
  getCustomization         // () => { removedIngredients, addedIngredients }
} = usePizzaCustomization();
```

### `useMenuItem()`
Gère l'état et les interactions d'un item (sélection, flash visuel).

```jsx
const {
  toggleItemSelection,  // (item)
  clearSelection,
  flashItem,           // (itemId, duration?)
  isItemSelected,      // (itemId) => boolean
  isItemFlashing       // (itemId) => boolean
} = useMenuItem();
```

### `useLiveOrder()`
Synchronise le panier avec Firebase en temps réel (brouillon de commande).

```jsx
const {
  liveOrderId,
  isSyncing,
  syncError,
  clearLiveOrder  // Supprime le brouillon
} = useLiveOrder(truckId, userId, cart, customerName);
```

## 🛠️ Utilitaires

### Prix (`priceCalculations.js`)

```jsx
import { 
  calculateTotalCents,     // (cart) => total HT
  calculateTVA,            // (totalCents, tvaRate?) => TVA
  calculateTotalTTC,       // (totalCents, tvaRate?) => TTC
  formatPrice,             // (cents) => "12.50€"
  getItemPrice,            // (item, size?) => priceCents
  getDisplayPrice,         // (item) => prix d'affichage
  hasValidPrice            // (item) => boolean
} from '@/features/menu/utils';
```

### Menu (`menuHelpers.js`)

```jsx
import {
  filterMenuByCategory,        // (menu, categoryId)
  extractIngredientsFromDescription, // (description)
  generateCartItemId,          // (item, size?)
  generateCartItemName,        // (item, size?, customization?)
  hasMultipleSizes,            // (item) => boolean
  getSingleSize,               // (item) => {size, data} | null
  getTotalCartItemsCount,      // (cart) => count
  findCartItem                 // (cart, itemId)
} from '@/features/menu/utils';
```

## 📦 Constantes

### Configuration (`menuConfig.js`)

```jsx
import {
  TVA_RATE,              // 0.10
  STORAGE_KEYS,          // { LIVE_CART, LIVE_CUSTOMER }
  MENU_ITEM_TYPES,       // { PIZZA, CALZONE, DESSERT, ... }
  MENU_CATEGORIES,       // { PIZZA, BOISSON, DESSERT }
  DRINK_SIZE_LABELS,     // { '33cl': '33cL', ... }
  PIZZA_SIZES            // { S, M, L }
} from '@/features/menu/constants';
```

### Ingrédients (`ingredients.js`)

```jsx
import {
  INGREDIENT_CATEGORIES,  // { BASES, LEGUMES, FROMAGES, ... }
  AVAILABLE_INGREDIENTS,  // Organisés par catégorie
  ALL_INGREDIENTS         // Liste plate
} from '@/features/menu/constants';
```

## 💡 Exemples d'utilisation

### Page Live (Pizzaiolo)

```jsx
import {
  useLiveCart,
  usePizzaCustomization,
  useMenuItem,
  useLiveOrder,
  ALL_INGREDIENTS,
  filterMenuByCategory,
  formatPrice,
  calculateTVA,
  calculateTotalTTC
} from '@/features/menu';

function PizzaioloLive() {
  const { cart, addToCart, totalCents } = useLiveCart();
  const { customizingPizza, startCustomization } = usePizzaCustomization();
  const { flashItem } = useMenuItem();
  
  // Filtrer le menu
  const pizzas = filterMenuByCategory(menu, 'pizza');
  
  // Ajouter au panier avec feedback
  const handleAdd = (item, size) => {
    flashItem(item.id);
    addToCart(item, size);
  };
  
  return (
    <div>
      {/* Menu */}
      {pizzas.map(pizza => (
        <PizzaCard 
          key={pizza.id}
          pizza={pizza}
          onAdd={handleAdd}
          onCustomize={startCustomization}
        />
      ))}
      
      {/* Panier */}
      <div>
        <p>Total HT: {formatPrice(totalCents)}</p>
        <p>TVA: {formatPrice(calculateTVA(totalCents))}</p>
        <p>Total TTC: {formatPrice(calculateTotalTTC(totalCents))}</p>
      </div>
    </div>
  );
}
```

### Page Menu (Création)

Les mêmes hooks et utilitaires peuvent être réutilisés pour :
- Afficher le menu avec prix formatés
- Gérer la personnalisation des pizzas
- Prévisualiser les items
- Calculer les prix selon les tailles

## 🚀 Avantages

- ✅ **Pas de duplication** : Code partagé entre Live et Menu
- ✅ **Facilité d'ajout de fonctionnalités** : Tout est centralisé
- ✅ **Tests simplifiés** : Hooks et utils isolés
- ✅ **Performance** : Calculs optimisés et mémoïsés
- ✅ **Type-safety ready** : Structure prête pour TypeScript

## 🔄 Migration

Pour migrer du code existant :

1. Remplacer les imports
2. Utiliser les hooks au lieu de useState/useEffect locaux
3. Utiliser les helpers au lieu de logique inline
4. Utiliser les constantes au lieu de valeurs en dur

**Avant :**
```jsx
const totalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
const totalTTC = totalCents * 1.10;
```

**Après :**
```jsx
import { calculateTotalCents, calculateTotalTTC } from '@/features/menu';

const totalCents = calculateTotalCents(cart);
const totalTTC = calculateTotalTTC(totalCents);
```

## 📝 Conventions

- Les prix sont **toujours en cents** (entiers)
- Les fonctions de calcul sont **pures** (pas d'effets de bord)
- Les hooks gèrent leur propre état
- Les utilitaires retournent null en cas d'erreur (pas de throw)
