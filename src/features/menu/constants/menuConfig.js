/**
 * Configuration et constantes pour la gestion du menu
 */

// TVA pour la restauration
export const TVA_RATE = 0.10; // 10%

// Clés localStorage
export const STORAGE_KEYS = {
  LIVE_CART: 'planizza_live_cart',
  LIVE_CUSTOMER: 'planizza_live_customer',
  LIVE_PICKUP_TIME: 'planizza_live_pickup_time'
};

// Types d'items du menu
export const MENU_ITEM_TYPES = {
  PIZZA: 'pizza',
  CALZONE: 'calzone',
  DESSERT: 'dessert',
  SODA: 'soda',
  EAU: 'eau',
  BIERE: 'biere',
  VIN: 'vin'
};

// Catégories pour l'affichage
export const MENU_CATEGORIES = {
  PIZZA: {
    id: 'pizza',
    label: 'Pizza',
    icon: 'Pizza',
    color: 'orange',
    types: [MENU_ITEM_TYPES.PIZZA, MENU_ITEM_TYPES.CALZONE]
  },
  BOISSON: {
    id: 'boisson',
    label: 'Boisson',
    icon: 'Wine',
    color: 'blue',
    types: [MENU_ITEM_TYPES.SODA, MENU_ITEM_TYPES.EAU, MENU_ITEM_TYPES.BIERE, MENU_ITEM_TYPES.VIN]
  },
  DESSERT: {
    id: 'dessert',
    label: 'Dessert',
    icon: 'IceCream',
    color: 'pink',
    types: [MENU_ITEM_TYPES.DESSERT]
  }
};

// Labels pour les tailles de boissons
export const DRINK_SIZE_LABELS = {
  '25cl': '25cL',
  '33cl': '33cL',
  '50cl': '50cL',
  '75cl': '75cL',
  '1l': '1L',
  '1.5l': '1,5L'
};

// Tailles de pizzas
export const PIZZA_SIZES = {
  S: 's',
  M: 'm',
  L: 'l'
};
