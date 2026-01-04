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
};
