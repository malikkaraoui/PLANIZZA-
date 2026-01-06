/**
 * Presets/valeurs UI pour la page Menu Pizzaiolo.
 *
 * Objectif : garder `src/pages/pizzaiolo/Menu.jsx` lisible en sortant les grosses constantes.
 *
 * NB: on conserve les valeurs telles qu'elles existaient dans la page pour éviter toute régression UX.
 */

export const ITEM_TYPES = [
  { value: 'pizza', label: '🍕 Pizza' },
  { value: 'calzone', label: '🥟 Calzone' },
  { value: 'dessert', label: '🍰 Dessert' },
  { value: 'soda', label: '🥤 Soda' },
  { value: 'eau', label: '💧 Eau (plate/pétillante)' },
  { value: 'biere', label: '🍺 Bière' },
  { value: 'vin', label: '🍷 Vin' },
];

export const PIZZA_SIZES = [
  { value: 's', label: 'S (26cm)', defaultDiameter: 26 },
  { value: 'm', label: 'M (34cm)', defaultDiameter: 34 },
  { value: 'l', label: 'L (44cm)', defaultDiameter: 44 },
];

export const PIZZAS_PREDEFINES = [
  {
    name: 'La Reine',
    ingredients: 'Sauce tomate, mozzarella, emmental, jambon, champignons, olives',
    emoji: '👑',
  },
  {
    name: 'La Margarita',
    ingredients: 'Sauce tomate, mozzarella, emmental, olives',
    emoji: '🌿',
  },
  {
    name: 'La Chèvre Miel',
    ingredients: 'Crème fraîche, mozzarella, emmental, chèvre, miel, olives',
    emoji: '🐐',
  },
  {
    name: 'La Napoli',
    ingredients: 'Sauce tomate, mozzarella, emmental, anchois, olives',
    emoji: '🐟',
  },
  {
    name: 'Autre',
    ingredients: '',
    emoji: '➕',
    custom: true,
  },
];

export const CALZONES_PREDEFINES = [
  {
    name: 'Calzone Classique',
    ingredients: 'Sauce tomate, mozzarella, jambon, champignons',
    emoji: '🥟',
  },
  {
    name: 'Calzone 3 Fromages',
    ingredients: 'Crème fraîche, mozzarella, gorgonzola, parmesan',
    emoji: '🧀',
  },
  {
    name: 'Calzone Végétarien',
    ingredients: 'Sauce tomate, mozzarella, légumes grillés',
    emoji: '🥗',
  },
  {
    name: 'Autre',
    ingredients: '',
    emoji: '➕',
    custom: true,
  },
];

export const BASES = ['Crème fraîche', 'Base Tomate'];

export const GARNITURES = ['Champignons de Paris', 'Oignons rouge', 'Tomates cerises', 'Poivrons'];

export const FROMAGES = ['Reblochon', 'Emmental', 'Gruyère', 'Burrata', 'Gorgonzola', 'Parmesan', 'Cabécou'];

export const DESSERTS = [
  { name: 'Tiramisu café', emoji: '☕', defaultPrice: 5.0 },
  { name: 'Tiramisu Nutella', emoji: '🍫', defaultPrice: 5.5 },
  { name: 'Tiramisu Spéculos', emoji: '🍪', defaultPrice: 5.5 },
  { name: 'Fondant chocolat', emoji: '🍰', defaultPrice: 6.0 },
  { name: 'Crumble pomme', emoji: '🍎', defaultPrice: 5.0 },
  { name: 'Crumble poire', emoji: '🍐', defaultPrice: 5.0 },
  { name: 'Autre', emoji: '➕', custom: true },
];

export const SODAS = [
  { name: 'Coca Cola', emoji: '🥤' },
  { name: 'Coca Cola Zéro', emoji: '🥤' },
  { name: 'Fanta Orange', emoji: '🍊' },
  { name: 'Fanta Citron', emoji: '🍋' },
  { name: 'Oasis Fruits Rouges', emoji: '🍓' },
  { name: 'Oasis Tropical', emoji: '🥭' },
  { name: 'Autre', emoji: '➕', custom: true },
];

export const EAUX = [
  { name: 'Badoit', emoji: '💧' },
  { name: 'Cristalline', emoji: '💧' },
  { name: 'Evian', emoji: '💧' },
  { name: 'Autre', emoji: '➕', custom: true },
];

export const BIERES = [
  { name: 'Heineken', emoji: '🍺' },
  { name: 'Affligem', emoji: '🍺' },
  { name: '1664', emoji: '🍺' },
  { name: 'Autre', emoji: '➕', custom: true },
];

export const VINS = [
  { name: 'GÉRARD BERTRAND : GRIS BLANC - 2023', defaultPrice: 11.5, emoji: '🍷' },
  { name: 'CLOS DES FEES - LES SORCIERES 2024', defaultPrice: 15.0, emoji: '🍷' },
  { name: 'Autre', emoji: '➕', custom: true },
];

export const DRINK_SIZES = {
  soda: [
    { value: '33cl', label: '33cL', defaultPrice: 3.0 },
    { value: '75cl', label: '75cL', defaultPrice: 5.0 },
    { value: '1l', label: '1L', defaultPrice: 6.0 },
    { value: '1.5l', label: '1,5L', defaultPrice: 7.0 },
  ],
  eau: [
    { value: '50cl', label: '50cL', defaultPrice: 1.8 },
    { value: '1l', label: '1L', defaultPrice: 2.5 },
  ],
  biere: [
    { value: '25cl', label: '25cL', defaultPrice: 3.0 },
    { value: '33cl', label: '33cL', defaultPrice: 5.0 },
  ],
};
