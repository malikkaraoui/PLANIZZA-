/**
 * Liste complète des ingrédients disponibles pour la personnalisation des pizzas
 * Organisés par catégorie pour faciliter l'affichage et la gestion
 */

export const INGREDIENT_CATEGORIES = {
  BASES: 'Bases',
  LEGUMES: 'Légumes',
  FROMAGES: 'Fromages',
  VIANDES: 'Viandes',
  POISSONS: 'Poissons',
  CONDIMENTS: 'Sauces & condiments',
  AUTRES: 'Autres'
};

export const AVAILABLE_INGREDIENTS = {
  [INGREDIENT_CATEGORIES.BASES]: [
    'Crème fraîche',
    'Base Tomate'
  ],
  [INGREDIENT_CATEGORIES.LEGUMES]: [
    'Olives noires',
    'Champignons frais',
    'Champignons de Paris',
    'Roquette croquante',
    'Aubergine grillée',
    'Poivrons',
    'Oignon rouge',
    'Artichaut',
    'Tomate cerise',
    'Roquette',
    'Œuf'
  ],
  [INGREDIENT_CATEGORIES.FROMAGES]: [
    'Crottin de chèvre',
    'Cabécou',
    'Gruyère',
    'Emmental',
    'Parmesan',
    'Mozzarella',
    'Burrata',
    'Gorgonzola',
    'Chèvre',
    'Le Bleu',
    'Brebis'
  ],
  [INGREDIENT_CATEGORIES.VIANDES]: [
    'Jambon de Parme',
    'Jambon cru',
    'Jambon de Bayonne',
    'Chorizo',
    'Boeuf',
    'Kebab',
    'Saucisson épicé',
    'Poulet',
    'Viande hachée'
  ],
  [INGREDIENT_CATEGORIES.POISSONS]: [
    'Saumon',
    'Anchois',
    'Thon'
  ],
  [INGREDIENT_CATEGORIES.CONDIMENTS]: [
    'Pesto',
    'Huile d’olive vierge',
    'Miel'
  ],
  [INGREDIENT_CATEGORIES.AUTRES]: [
    'Basilic'
  ]
};

// Liste plate de tous les ingrédients pour compatibilité avec le code existant
export const ALL_INGREDIENTS = Object.values(AVAILABLE_INGREDIENTS).flat();
