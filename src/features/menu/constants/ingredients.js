/**
 * Liste complète des ingrédients disponibles pour la personnalisation des pizzas
 * Organisés par catégorie pour faciliter l'affichage et la gestion
 */

export const INGREDIENT_CATEGORIES = {
  BASES: 'Bases',
  LEGUMES: 'Légumes',
  FROMAGES: 'Fromages',
  VIANDES: 'Viandes',
  AUTRES: 'Autres'
};

export const AVAILABLE_INGREDIENTS = {
  [INGREDIENT_CATEGORIES.BASES]: [
    'Crème fraîche',
    'Base Tomate'
  ],
  [INGREDIENT_CATEGORIES.LEGUMES]: [
    'Champignons',
    'Oignons rouge',
    'Tomates cerises',
    'Poivrons',
    'Olives',
    'Tomate',
    'Roquette'
  ],
  [INGREDIENT_CATEGORIES.FROMAGES]: [
    'Reblochon',
    'Emmental',
    'Gruyère',
    'Burrata',
    'Gorgonzola',
    'Parmesan',
    'Cabécou',
    'Mozzarella',
    'Chèvre'
  ],
  [INGREDIENT_CATEGORIES.VIANDES]: [
    'Jambon',
    'Chorizo',
    'Lardons',
    'Saucisse',
    'Poulet'
  ],
  [INGREDIENT_CATEGORIES.AUTRES]: [
    'Basilic',
    'Miel'
  ]
};

// Liste plate de tous les ingrédients pour compatibilité avec le code existant
export const ALL_INGREDIENTS = Object.values(AVAILABLE_INGREDIENTS).flat();
