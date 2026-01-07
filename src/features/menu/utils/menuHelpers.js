import { MENU_CATEGORIES, DRINK_SIZE_LABELS } from '../constants/menuConfig';
import { normalizeProductName } from './normalizeProductName';

/**
 * Filtre le menu par catégorie
 * @param {Array} menu - Menu complet
 * @param {string} categoryId - ID de la catégorie (pizza, boisson, dessert)
 * @returns {Array} Items filtrés
 */
export const filterMenuByCategory = (menu, categoryId) => {
  if (!menu || !categoryId) return [];
  
  const category = MENU_CATEGORIES[categoryId.toUpperCase()];
  if (!category) return [];
  
  return menu.filter(item => category.types.includes(item.type));
};

/**
 * Extrait les ingrédients depuis la description d'un item
 * @param {string} description - Description de l'item
 * @returns {Array<string>} Liste des ingrédients
 */
export const extractIngredientsFromDescription = (description) => {
  if (!description) return [];
  
  return description
    .split(',')
    .map(i => i.trim())
    .filter(i => i.length > 0);
};

/**
 * Génère un ID unique pour un item du panier
 * @param {Object} item - Item du menu
 * @param {string} size - Taille (optionnelle)
 * @returns {string} ID unique
 */
export const generateCartItemId = (item, size = null) => {
  if (!item?.id) return null;
  
  return size ? `${item.id}-${size}` : item.id;
};

/**
 * Génère le nom d'affichage pour un item du panier
 * @param {Object} item - Item du menu
 * @param {string} size - Taille (optionnelle)
 * @param {Object} customization - Personnalisation (optionnelle)
 * @returns {string} Nom formaté
 */
export const generateCartItemName = (item, size = null, customization = null) => {
  if (!item?.name) return '';
  
  let name = normalizeProductName(item.name);
  
  // Ajouter la taille pour pizzas
  if (item.type === 'pizza' && size) {
    name += ` (${size.toUpperCase()})`;
  }
  
  // Ajouter la taille pour boissons avec label approprié
  if (['soda', 'eau', 'biere'].includes(item.type) && size) {
    const sizeLabel = DRINK_SIZE_LABELS[size] || size;
    name += ` (${sizeLabel})`;
  }
  
  // Ajouter la personnalisation
  if (customization && (customization.removedIngredients?.length > 0 || customization.addedIngredients?.length > 0)) {
    const changes = [];
    
    if (customization.removedIngredients?.length > 0) {
      changes.push(`Sans: ${customization.removedIngredients.join(', ')}`);
    }
    
    if (customization.addedIngredients?.length > 0) {
      changes.push(`Avec: ${customization.addedIngredients.join(', ')}`);
    }
    
    name += ` [${changes.join(' | ')}]`;
  }
  
  return name;
};

/**
 * Vérifie si un item a plusieurs tailles
 * @param {Object} item - Item du menu
 * @returns {boolean}
 */
export const hasMultipleSizes = (item) => {
  if (!item?.sizes) return false;
  return Object.keys(item.sizes).length > 1;
};

/**
 * Vérifie si un item a une seule taille
 * @param {Object} item - Item du menu
 * @returns {Object|null} {size: string, data: Object} ou null
 */
export const getSingleSize = (item) => {
  if (!item?.sizes) return null;
  
  const sizes = Object.entries(item.sizes);
  if (sizes.length !== 1) return null;
  
  const [size, data] = sizes[0];
  return { size, data };
};

/**
 * Compte le nombre total d'items dans le panier
 * @param {Array} cart - Panier
 * @returns {number} Nombre total d'items
 */
export const getTotalCartItemsCount = (cart = []) => {
  return cart.reduce((sum, item) => sum + item.qty, 0);
};

/**
 * Trouve un item dans le panier par son ID
 * @param {Array} cart - Panier
 * @param {string} itemId - ID de l'item
 * @returns {Object|null} Item trouvé avec son index
 */
export const findCartItem = (cart, itemId) => {
  const index = cart.findIndex(i => i.id === itemId);
  if (index === -1) return null;
  
  return { item: cart[index], index };
};
