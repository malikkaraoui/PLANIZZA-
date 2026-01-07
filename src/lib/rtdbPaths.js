/**
 * Centralisation des chemins RTDB.
 *
 * Objectif: éviter les strings "magiques" dispersées et réduire les erreurs de path.
 *
 * NB: on retourne des strings (pas des refs) pour rester flexible (ref/query).
 */

export const rtdbPaths = {
  ordersRoot: () => 'orders',

  user: (uid) => `users/${uid}`,
  pizzaiolo: (uid) => `pizzaiolos/${uid}`,

  publicTrucksRoot: () => 'public/trucks',
  truck: (truckId) => `public/trucks/${truckId}`,
  truckMenuItems: (truckId) => `public/trucks/${truckId}/menu/items`,

  // Ingrédients (personnalisation) : géré par le pizzaiolo, lecture publique.
  // On le met sous `menus/` car les règles RTDB existantes protègent l'écriture par owner.
  truckIngredients: (truckId) => `menus/${truckId}/ingredients`,
};
