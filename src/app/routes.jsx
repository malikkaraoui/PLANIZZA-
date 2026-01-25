// Centralisation des routes de l'app (évite les strings dispersées)

export const ROUTES = {
  root: '/',

  // Public
  explore: '/explore',
  truck: (truckId = ':truckId') => `/${truckId}`,
  cart: '/panier',
  checkout: '/checkout',
  checkoutSuccess: '/checkout/success',
  order: (orderId = ':orderId') => `/order/${orderId}`,

  // Auth
  login: '/login',
  register: '/register',

  // Client (privé)
  dashboard: '/dashboard',
  account: '/mon-compte',
  myOrders: '/commandes',

  // Pizzaiolo
  pizzaioloStart: '/pizzaiolo/start',
  pizzaioloBase: '/pizzaiolo',
  pizzaioloDashboard: '/pro/truck',
  pizzaioloProfile: '/pro/truck',
  pizzaioloMenu: '/pro/menu',
  pizzaioloOrders: '/pro/commandes',
  pizzaioloOrdersV2: '/pro/commandes-v2',
  pizzaioloStats: '/pro/stats',
  pizzaioloLive: '/pro/live',
  stripeOnboarding: '/pro/onboarding',

  // Partenaires / Pro
  becomePartner: '/devenez_partenaire',

  // Legacy (compat)
  legacyTrucks: '/trucks',
  legacyTruckShort: (truckId = ':truckId') => `/t/${truckId}`,
  legacyTruckLong: (truckId = ':truckId') => `/trucks/${truckId}`,
};
