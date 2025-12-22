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
  account: '/mon-compte',
  myOrders: '/commandes',

  // Pizzaiolo
  pizzaioloStart: '/pizzaiolo/start',
  pizzaioloBase: '/pizzaiolo',
  pizzaioloDashboard: '/pizzaiolo/dashboard',
  pizzaioloProfile: '/pizzaiolo/profile',
  pizzaioloMenu: '/pizzaiolo/menu',
  pizzaioloOrders: '/pizzaiolo/orders',

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
