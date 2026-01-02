// Centralisation des routes de l'app (évite les strings dispersées)

export const ROUTES = {
  root: '/',

  // Public
  explore: '/explore',
  truck: (truckId = ':truckId') => `/truck/${truckId}`,
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
  pizzaioloLive: '/pro/live',

  // Partenaires / Pro
  becomePartner: '/devenez_partenaire',
  becomePartnerForm: '/devenez_partenaire/inscription',
  becomePartnerValidation: '/devenez_partenaire/validation',
  becomePartnerPricing: '/devenez_partenaire/tarifs',

  // Legacy (compat)
  legacyTrucks: '/trucks',
  legacyTruckShort: (truckId = ':truckId') => `/t/${truckId}`,
  legacyTruckLong: (truckId = ':truckId') => `/trucks/${truckId}`,
};
